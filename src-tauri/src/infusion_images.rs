// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::fs::File;
use std::io::{BufWriter, Cursor};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use image::codecs::jpeg::JpegEncoder;
use image::{DynamicImage, GenericImageView, ImageFormat, ImageReader, Limits, RgbImage};
use once_cell::sync::Lazy;
use sha2::{Digest, Sha256};
use tauri::Manager;

const INFUSION_IMAGE_CACHE_DIR: &str = "infusion-images";
const MAX_INPUT_IMAGE_BYTES: usize = 8 * 1024 * 1024;
const MAX_INPUT_IMAGE_DIMENSION: u32 = 2_048;
const MAX_INPUT_IMAGE_PIXELS: u64 = 4_194_304;
const MAX_DECODE_ALLOCATION_BYTES: u64 = 64 * 1024 * 1024;
const MAX_BLUR_RADIUS: f32 = 128.0;
const MIN_COLOR_FILTER_PERCENT: f32 = 0.0;
const MAX_COLOR_FILTER_PERCENT: f32 = 200.0;
const MAX_NOISE_STRENGTH: f32 = 1.0;
const MIN_NOISE_SCALE: f32 = 0.1;
const MAX_NOISE_SCALE: f32 = 8.0;
const MAX_CACHE_ITEM_COUNT: usize = 32;
const MAX_CACHE_SIZE_BYTES: u64 = 128 * 1024 * 1024;
const OUTPUT_JPEG_QUALITY: u8 = 88;

static INFUSION_IMAGE_CACHE_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));
static TEMPORARY_IMAGE_COUNTER: AtomicU64 = AtomicU64::new(0);

fn normalize_blur(value: f32) -> Result<f32, String> {
    if !value.is_finite() {
        return Err("Infusion image blur is invalid".to_string());
    }

    Ok((value.clamp(0.0, MAX_BLUR_RADIUS) * 100.0).round() / 100.0)
}

fn normalize_color_filter(value: f32, name: &str) -> Result<f32, String> {
    if !value.is_finite() {
        return Err(format!("Infusion image {name} is invalid"));
    }

    Ok((value.clamp(MIN_COLOR_FILTER_PERCENT, MAX_COLOR_FILTER_PERCENT) * 100.0).round() / 100.0)
}

fn normalize_noise_strength(value: f32) -> Result<f32, String> {
    if !value.is_finite() {
        return Err("Infusion image noise strength is invalid".to_string());
    }

    Ok((value.clamp(0.0, MAX_NOISE_STRENGTH) * 10_000.0).round() / 10_000.0)
}

fn normalize_noise_scale(value: f32) -> Result<f32, String> {
    if !value.is_finite() {
        return Err("Infusion image noise scale is invalid".to_string());
    }

    Ok((value.clamp(MIN_NOISE_SCALE, MAX_NOISE_SCALE) * 100.0).round() / 100.0)
}

fn decode_input_image_data_url(image_data_url: &str) -> Result<Vec<u8>, String> {
    let (metadata, encoded_image) = image_data_url
        .split_once(',')
        .ok_or_else(|| "Infusion image data URL is invalid".to_string())?;

    if metadata != "data:image/jpeg;base64" {
        return Err("Infusion image data format is unsupported".to_string());
    }

    let estimated_size = encoded_image.len().saturating_mul(3) / 4;

    if estimated_size > MAX_INPUT_IMAGE_BYTES {
        return Err("Infusion image data is too large".to_string());
    }

    let image_bytes = BASE64_STANDARD
        .decode(encoded_image)
        .map_err(|error| format!("Failed to decode infusion image data: {error}"))?;

    if image_bytes.is_empty() {
        return Err("Infusion image data is empty".to_string());
    }

    if image_bytes.len() > MAX_INPUT_IMAGE_BYTES {
        return Err("Infusion image data is too large".to_string());
    }

    Ok(image_bytes)
}

fn infusion_decode_limits() -> Limits {
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_INPUT_IMAGE_DIMENSION);
    limits.max_image_height = Some(MAX_INPUT_IMAGE_DIMENSION);
    limits.max_alloc = Some(MAX_DECODE_ALLOCATION_BYTES);
    limits
}

fn decode_input_image(image_bytes: &[u8]) -> Result<DynamicImage, String> {
    let mut reader = ImageReader::with_format(Cursor::new(image_bytes), ImageFormat::Jpeg);
    reader.limits(infusion_decode_limits());
    let image = reader
        .decode()
        .map_err(|error| format!("Failed to decode infusion image: {error}"))?;
    let (width, height) = image.dimensions();
    let pixel_count = u64::from(width).saturating_mul(u64::from(height));

    if width == 0 || height == 0 || pixel_count > MAX_INPUT_IMAGE_PIXELS {
        return Err("Infusion image dimensions are invalid".to_string());
    }

    Ok(image)
}

fn apply_color_filters(image: &mut RgbImage, contrast: f32, brightness: f32) {
    let contrast_factor = contrast / 100.0;
    let brightness_factor = brightness / 100.0;

    if contrast_factor == 1.0 && brightness_factor == 1.0 {
        return;
    }

    for pixel in image.pixels_mut() {
        for channel in &mut pixel.0 {
            let normalized = f32::from(*channel) / 255.0;
            let adjusted =
                (((normalized - 0.5) * contrast_factor + 0.5) * brightness_factor).clamp(0.0, 1.0);
            *channel = (adjusted * 255.0).round() as u8;
        }
    }
}

fn noise_value(seed: u64, x: u32, y: u32) -> f32 {
    let mut value = seed
        ^ u64::from(x).wrapping_mul(0x9E37_79B1_85EB_CA87)
        ^ u64::from(y).wrapping_mul(0xC2B2_AE3D_27D4_EB4F);
    value = (value ^ (value >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    value = (value ^ (value >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    value ^= value >> 31;
    ((value >> 40) as f32) / 16_777_215.0
}

fn apply_noise(image: &mut RgbImage, strength: f32, scale: f32, seed: u64) {
    if strength == 0.0 {
        return;
    }

    let block_size = scale.max(1.0).round() as u32;

    for (x, y, pixel) in image.enumerate_pixels_mut() {
        let noise = noise_value(seed, x / block_size, y / block_size);

        for channel in &mut pixel.0 {
            let background = f32::from(*channel) / 255.0;
            let overlay = if background < 0.5 {
                2.0 * background * noise
            } else {
                1.0 - (2.0 * (1.0 - background) * (1.0 - noise))
            };
            let adjusted = (background * (1.0 - strength) + overlay * strength).clamp(0.0, 1.0);
            *channel = (adjusted * 255.0).round() as u8;
        }
    }
}

fn infusion_noise_seed(image_bytes: &[u8]) -> u64 {
    let hash = Sha256::digest(image_bytes);
    let mut seed_bytes = [0u8; 8];
    seed_bytes.copy_from_slice(&hash[..8]);
    u64::from_le_bytes(seed_bytes)
}

fn hash_to_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()
}

fn infusion_image_cache_key(
    image_bytes: &[u8],
    blur: f32,
    contrast: f32,
    brightness: f32,
    noise_strength: f32,
    noise_scale: f32,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"infusion-image-v1");
    hasher.update([0]);
    hasher.update(image_bytes);
    hasher.update(blur.to_bits().to_le_bytes());
    hasher.update(contrast.to_bits().to_le_bytes());
    hasher.update(brightness.to_bits().to_le_bytes());
    hasher.update(noise_strength.to_bits().to_le_bytes());
    hasher.update(noise_scale.to_bits().to_le_bytes());
    hash_to_hex(&hasher.finalize())
}

fn temporary_image_path(image_path: &Path) -> PathBuf {
    let temporary_id = TEMPORARY_IMAGE_COUNTER.fetch_add(1, Ordering::Relaxed);
    image_path.with_extension(format!("tmp-{temporary_id}"))
}

fn write_processed_image(image: &DynamicImage, output_path: &Path) -> Result<(), String> {
    let file = File::create(output_path)
        .map_err(|error| format!("Failed to create processed infusion image: {error}"))?;
    let writer = BufWriter::new(file);
    let encoder = JpegEncoder::new_with_quality(writer, OUTPUT_JPEG_QUALITY);

    image
        .write_with_encoder(encoder)
        .map_err(|error| format!("Failed to write processed infusion image: {error}"))
}

fn enforce_cache_limits(cache_dir: &Path, active_path: &Path) -> Result<(), String> {
    let mut cache_items = fs::read_dir(cache_dir)
        .map_err(|error| format!("Failed to read infusion image cache: {error}"))?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            let metadata = entry.metadata().ok()?;

            if !metadata.is_file() || path == active_path {
                return None;
            }

            let modified = metadata.modified().ok();
            Some((path, metadata.len(), modified))
        })
        .collect::<Vec<_>>();
    let mut total_size = cache_items.iter().fold(
        fs::metadata(active_path)
            .map(|metadata| metadata.len())
            .unwrap_or(0),
        |size, item| size.saturating_add(item.1),
    );
    let mut total_count = cache_items.len() + usize::from(active_path.exists());

    cache_items.sort_by_key(|item| item.2);

    for (path, size, _) in cache_items {
        if total_count <= MAX_CACHE_ITEM_COUNT && total_size <= MAX_CACHE_SIZE_BYTES {
            break;
        }

        if fs::remove_file(path).is_ok() {
            total_count = total_count.saturating_sub(1);
            total_size = total_size.saturating_sub(size);
        }
    }

    Ok(())
}

fn generate_infusion_image_file(
    cache_dir: PathBuf,
    image_data_url: String,
    blur: f32,
    contrast: f32,
    brightness: f32,
    noise_strength: f32,
    noise_scale: f32,
) -> Result<String, String> {
    let blur = normalize_blur(blur)?;
    let contrast = normalize_color_filter(contrast, "contrast")?;
    let brightness = normalize_color_filter(brightness, "brightness")?;
    let noise_strength = normalize_noise_strength(noise_strength)?;
    let noise_scale = normalize_noise_scale(noise_scale)?;
    let image_bytes = decode_input_image_data_url(&image_data_url)?;
    let cache_key = infusion_image_cache_key(
        &image_bytes,
        blur,
        contrast,
        brightness,
        noise_strength,
        noise_scale,
    );
    let image_path = cache_dir.join(format!("{cache_key}.jpg"));
    let _cache_lock = INFUSION_IMAGE_CACHE_LOCK
        .lock()
        .map_err(|error| format!("Failed to lock infusion image cache: {error}"))?;

    fs::create_dir_all(&cache_dir)
        .map_err(|error| format!("Failed to create infusion image cache: {error}"))?;

    if image_path.exists() {
        return Ok(image_path.to_string_lossy().to_string());
    }

    let image = decode_input_image(&image_bytes)?;
    let processed_image = if blur > 0.0 { image.blur(blur) } else { image };
    let mut rgb_image = processed_image.to_rgb8();
    apply_color_filters(&mut rgb_image, contrast, brightness);
    apply_noise(
        &mut rgb_image,
        noise_strength,
        noise_scale,
        infusion_noise_seed(&image_bytes),
    );
    let processed_image = DynamicImage::ImageRgb8(rgb_image);
    let temporary_path = temporary_image_path(&image_path);

    if let Err(error) = write_processed_image(&processed_image, &temporary_path) {
        let _ = fs::remove_file(&temporary_path);
        return Err(error);
    }

    if let Err(error) = fs::rename(&temporary_path, &image_path) {
        let _ = fs::remove_file(&temporary_path);
        return Err(format!(
            "Failed to finalize processed infusion image: {error}"
        ));
    }

    enforce_cache_limits(&cache_dir, &image_path)?;

    Ok(image_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn generate_infusion_image(
    app: tauri::AppHandle,
    image_data_url: String,
    blur: f32,
    contrast: f32,
    brightness: f32,
    noise_strength: f32,
    noise_scale: f32,
) -> Result<String, String> {
    let cache_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?
        .join(INFUSION_IMAGE_CACHE_DIR);

    tauri::async_runtime::spawn_blocking(move || {
        generate_infusion_image_file(
            cache_dir,
            image_data_url,
            blur,
            contrast,
            brightness,
            noise_strength,
            noise_scale,
        )
    })
    .await
    .map_err(|error| format!("Failed to generate infusion image: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::{
        apply_color_filters, apply_noise, generate_infusion_image_file, infusion_image_cache_key,
        MAX_INPUT_IMAGE_BYTES,
    };
    use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
    use base64::Engine;
    use image::codecs::jpeg::JpegEncoder;
    use image::{DynamicImage, Rgb, RgbImage};
    use std::io::Cursor;

    fn test_image_data_url() -> String {
        let image = RgbImage::from_fn(32, 32, |x, y| Rgb([(x * 8) as u8, (y * 8) as u8, 128]));
        let mut encoded = Vec::new();
        DynamicImage::ImageRgb8(image)
            .write_with_encoder(JpegEncoder::new_with_quality(Cursor::new(&mut encoded), 90))
            .unwrap();
        format!("data:image/jpeg;base64,{}", BASE64_STANDARD.encode(encoded))
    }

    #[test]
    fn cache_key_changes_with_filters() {
        let bytes = b"image";
        let first = infusion_image_cache_key(bytes, 10.0, 100.0, 100.0, 0.0, 1.0);
        let second = infusion_image_cache_key(bytes, 11.0, 100.0, 100.0, 0.0, 1.0);
        let third = infusion_image_cache_key(bytes, 10.0, 110.0, 100.0, 0.0, 1.0);
        let fourth = infusion_image_cache_key(bytes, 10.0, 100.0, 100.0, 0.1, 1.0);

        assert_ne!(first, second);
        assert_ne!(first, third);
        assert_ne!(first, fourth);
    }

    #[test]
    fn processed_images_are_cached() {
        let temp_dir = tempfile::tempdir().unwrap();
        let image_data_url = test_image_data_url();
        let first = generate_infusion_image_file(
            temp_dir.path().to_path_buf(),
            image_data_url.clone(),
            2.0,
            100.0,
            100.0,
            0.025,
            0.5,
        )
        .unwrap();
        let second = generate_infusion_image_file(
            temp_dir.path().to_path_buf(),
            image_data_url,
            2.0,
            100.0,
            100.0,
            0.025,
            0.5,
        )
        .unwrap();

        assert_eq!(first, second);
        assert!(std::path::Path::new(&first).is_file());
    }

    #[test]
    fn color_filters_match_css_filter_order() {
        let mut image = RgbImage::from_pixel(1, 1, Rgb([128, 64, 255]));
        apply_color_filters(&mut image, 120.0, 80.0);

        assert_eq!(image.get_pixel(0, 0).0, [102, 41, 224]);
    }

    #[test]
    fn baked_noise_is_deterministic() {
        let mut first = RgbImage::from_pixel(8, 8, Rgb([64, 128, 192]));
        let mut second = first.clone();
        apply_noise(&mut first, 0.25, 1.0, 42);
        apply_noise(&mut second, 0.25, 1.0, 42);

        assert_eq!(first, second);
        assert_ne!(first.get_pixel(0, 0).0, [64, 128, 192]);
    }

    #[test]
    fn oversized_input_is_rejected_before_decoding() {
        let temp_dir = tempfile::tempdir().unwrap();
        let oversized_data = "A".repeat((MAX_INPUT_IMAGE_BYTES * 4 / 3) + 8);
        let result = generate_infusion_image_file(
            temp_dir.path().to_path_buf(),
            format!("data:image/jpeg;base64,{oversized_data}"),
            0.0,
            100.0,
            100.0,
            0.0,
            1.0,
        );

        assert!(result.is_err());
    }
}
