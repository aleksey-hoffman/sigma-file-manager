// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::fs::File;
use std::io::BufWriter;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use image::codecs::png::{CompressionType, FilterType as PngFilterType, PngEncoder};
use image::{imageops::FilterType, ImageReader, Limits};
use once_cell::sync::Lazy;
use sha2::{Digest, Sha256};
use tauri::Manager;

const IMAGE_THUMBNAIL_CACHE_DIR: &str = "image-thumbnails";
const THUMBNAIL_MAX_DIMENSION: u32 = 384;
const MAX_THUMBNAIL_CACHE_ITEM_COUNT: usize = 5000;
const MAX_THUMBNAIL_CACHE_SIZE_BYTES: u64 = 1024 * 1024 * 1024;
const THUMBNAIL_CACHE_LIMIT_CHECK_INTERVAL: usize = 100;
const MAX_THUMBNAIL_SOURCE_FILE_SIZE_BYTES: u64 = 128 * 1024 * 1024;
const MAX_THUMBNAIL_SOURCE_DIMENSION: u32 = 32_768;
const MAX_THUMBNAIL_SOURCE_PIXELS: u64 = 50_000_000;
const MAX_THUMBNAIL_DECODE_ALLOCATION_BYTES: u64 = 192 * 1024 * 1024;
const MAX_ORIGINAL_IMAGE_THUMBNAIL_SOURCE_SIZE_BYTES: u64 = 512 * 1024;
const MAX_VIDEO_THUMBNAIL_CACHE_BYTES: usize = 2 * 1024 * 1024;
const IMAGE_THUMBNAIL_RESIZE_FILTER: FilterType = FilterType::Triangle;
const IMAGE_THUMBNAIL_PNG_COMPRESSION: CompressionType = CompressionType::Fast;
const IMAGE_THUMBNAIL_PNG_FILTER: PngFilterType = PngFilterType::Adaptive;

static IMAGE_THUMBNAIL_CACHE_FILE_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));
static IMAGE_THUMBNAIL_CACHE_MAINTENANCE: Lazy<Mutex<ThumbnailCacheMaintenanceState>> =
    Lazy::new(|| Mutex::new(ThumbnailCacheMaintenanceState::default()));
static TEMPORARY_THUMBNAIL_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Default)]
struct ThumbnailCacheStats {
    item_count: usize,
    size_bytes: u64,
}

#[derive(Default)]
struct ThumbnailCacheMaintenanceState {
    checked_once: bool,
    generated_since_check: usize,
}

fn normalize_thumbnail_max_dimension(_max_dimension: Option<u32>) -> u32 {
    THUMBNAIL_MAX_DIMENSION
}

fn hash_to_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()
}

fn thumbnail_cache_key(path: &str, modified_time: u64, size: u64, max_dimension: u32) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    hasher.update([0]);
    hasher.update(modified_time.to_le_bytes());
    hasher.update(size.to_le_bytes());
    hasher.update(max_dimension.to_le_bytes());
    hash_to_hex(&hasher.finalize())
}

fn video_thumbnail_cache_key(
    path: &str,
    modified_time: u64,
    size: u64,
    width: u32,
    height: u32,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"video");
    hasher.update([0]);
    hasher.update(path.as_bytes());
    hasher.update([0]);
    hasher.update(modified_time.to_le_bytes());
    hasher.update(size.to_le_bytes());
    hasher.update(width.to_le_bytes());
    hasher.update(height.to_le_bytes());
    hash_to_hex(&hasher.finalize())
}

fn thumbnail_cache_path(
    cache_dir: &Path,
    path: &str,
    modified_time: u64,
    size: u64,
    max_dimension: u32,
) -> PathBuf {
    cache_dir.join(format!(
        "{}.png",
        thumbnail_cache_key(path, modified_time, size, max_dimension)
    ))
}

fn video_thumbnail_cache_path(
    cache_dir: &Path,
    path: &str,
    modified_time: u64,
    size: u64,
    width: u32,
    height: u32,
) -> PathBuf {
    cache_dir.join(format!(
        "{}.jpg",
        video_thumbnail_cache_key(path, modified_time, size, width, height)
    ))
}

fn thumbnail_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?
        .join(IMAGE_THUMBNAIL_CACHE_DIR))
}

fn path_is_same_or_descendant(path: &Path, parent: &Path) -> bool {
    path == parent || path.starts_with(parent)
}

fn add_thumbnail_cache_path_stats(
    path: &Path,
    stats: &mut ThumbnailCacheStats,
) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Failed to read cache item: {error}"))?;

    stats.item_count += 1;

    if metadata.is_file() {
        stats.size_bytes = stats.size_bytes.saturating_add(metadata.len());
        return Ok(());
    }

    if metadata.is_dir() {
        for entry in fs::read_dir(path)
            .map_err(|error| format!("Failed to read thumbnail cache directory: {error}"))?
        {
            let entry =
                entry.map_err(|error| format!("Failed to read thumbnail cache item: {error}"))?;
            add_thumbnail_cache_path_stats(&entry.path(), stats)?;
        }
    }

    Ok(())
}

fn thumbnail_cache_stats(cache_dir: &Path) -> Result<ThumbnailCacheStats, String> {
    let mut stats = ThumbnailCacheStats::default();

    for entry in fs::read_dir(cache_dir)
        .map_err(|error| format!("Failed to read thumbnail cache directory: {error}"))?
    {
        let entry =
            entry.map_err(|error| format!("Failed to read thumbnail cache item: {error}"))?;
        add_thumbnail_cache_path_stats(&entry.path(), &mut stats)?;
    }

    Ok(stats)
}

fn clear_thumbnail_cache_dir(cache_dir: &Path) -> Result<(), String> {
    for entry in fs::read_dir(cache_dir)
        .map_err(|error| format!("Failed to read thumbnail cache directory: {error}"))?
    {
        let entry =
            entry.map_err(|error| format!("Failed to read thumbnail cache item: {error}"))?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| format!("Failed to read thumbnail cache item: {error}"))?;

        if metadata.is_dir() {
            fs::remove_dir_all(&path)
                .map_err(|error| format!("Failed to clear thumbnail cache directory: {error}"))?;
        } else {
            fs::remove_file(&path)
                .map_err(|error| format!("Failed to clear thumbnail cache file: {error}"))?;
        }
    }

    Ok(())
}

fn enforce_thumbnail_cache_limits(cache_dir: &Path) -> Result<(), String> {
    let stats = thumbnail_cache_stats(cache_dir)?;

    if stats.item_count >= MAX_THUMBNAIL_CACHE_ITEM_COUNT
        || stats.size_bytes > MAX_THUMBNAIL_CACHE_SIZE_BYTES
    {
        clear_thumbnail_cache_dir(cache_dir)?;
    }

    Ok(())
}

fn should_enforce_thumbnail_cache_limits() -> Result<bool, String> {
    let mut state = IMAGE_THUMBNAIL_CACHE_MAINTENANCE
        .lock()
        .map_err(|error| format!("Failed to lock thumbnail cache maintenance: {error}"))?;

    if !state.checked_once {
        state.checked_once = true;
        state.generated_since_check = 0;
        return Ok(true);
    }

    if state.generated_since_check >= THUMBNAIL_CACHE_LIMIT_CHECK_INTERVAL {
        state.generated_since_check = 0;
        return Ok(true);
    }

    Ok(false)
}

fn record_generated_thumbnail() -> Result<(), String> {
    let mut state = IMAGE_THUMBNAIL_CACHE_MAINTENANCE
        .lock()
        .map_err(|error| format!("Failed to lock thumbnail cache maintenance: {error}"))?;

    state.generated_since_check += 1;

    Ok(())
}

fn temporary_thumbnail_path(thumbnail_path: &Path) -> PathBuf {
    let temporary_id = TEMPORARY_THUMBNAIL_COUNTER.fetch_add(1, Ordering::Relaxed);
    thumbnail_path.with_extension(format!("tmp-{temporary_id}"))
}

fn thumbnail_decode_limits() -> Limits {
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_THUMBNAIL_SOURCE_DIMENSION);
    limits.max_image_height = Some(MAX_THUMBNAIL_SOURCE_DIMENSION);
    limits.max_alloc = Some(MAX_THUMBNAIL_DECODE_ALLOCATION_BYTES);
    limits
}

fn validate_image_thumbnail_source(
    source_size: u64,
    width: u32,
    height: u32,
) -> Result<(), String> {
    if source_size > MAX_THUMBNAIL_SOURCE_FILE_SIZE_BYTES {
        return Err("Image is too large to thumbnail".to_string());
    }

    let pixel_count = u64::from(width).saturating_mul(u64::from(height));

    if width == 0 || height == 0 || pixel_count > MAX_THUMBNAIL_SOURCE_PIXELS {
        return Err("Image dimensions are too large to thumbnail".to_string());
    }

    Ok(())
}

fn is_browser_renderable_image_path(source_path: &Path) -> bool {
    let Some(extension) = source_path
        .extension()
        .and_then(|extension| extension.to_str())
    else {
        return false;
    };

    matches!(
        extension.to_ascii_lowercase().as_str(),
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "ico"
    )
}

fn should_use_original_image_thumbnail(
    source_path: &Path,
    source_size: u64,
    width: u32,
    height: u32,
    max_dimension: u32,
) -> bool {
    source_size <= MAX_ORIGINAL_IMAGE_THUMBNAIL_SOURCE_SIZE_BYTES
        && width <= max_dimension
        && height <= max_dimension
        && is_browser_renderable_image_path(source_path)
}

fn image_dimensions(source_path: &Path) -> Result<(u32, u32), String> {
    let mut reader = ImageReader::open(source_path)
        .map_err(|error| format!("Failed to open image thumbnail source: {error}"))?
        .with_guessed_format()
        .map_err(|error| format!("Failed to detect image thumbnail format: {error}"))?;
    reader.limits(thumbnail_decode_limits());

    reader
        .into_dimensions()
        .map_err(|error| format!("Failed to read image thumbnail dimensions: {error}"))
}

fn decode_image_thumbnail_source(source_path: &Path) -> Result<image::DynamicImage, String> {
    let mut reader = ImageReader::open(source_path)
        .map_err(|error| format!("Failed to open image thumbnail source: {error}"))?
        .with_guessed_format()
        .map_err(|error| format!("Failed to detect image thumbnail format: {error}"))?;
    reader.limits(thumbnail_decode_limits());

    reader
        .decode()
        .map_err(|error| format!("Failed to decode image thumbnail source: {error}"))
}

fn write_image_thumbnail(
    thumbnail: &image::DynamicImage,
    thumbnail_path: &Path,
) -> Result<(), String> {
    let file = File::create(thumbnail_path)
        .map_err(|error| format!("Failed to create image thumbnail: {error}"))?;
    let writer = BufWriter::new(file);
    let encoder = PngEncoder::new_with_quality(
        writer,
        IMAGE_THUMBNAIL_PNG_COMPRESSION,
        IMAGE_THUMBNAIL_PNG_FILTER,
    );

    thumbnail
        .write_with_encoder(encoder)
        .map_err(|error| format!("Failed to write image thumbnail: {error}"))
}

fn validate_video_thumbnail_size(width: u32, height: u32) -> Result<(), String> {
    if width == 0 || height == 0 {
        return Err("Video thumbnail dimensions are invalid".to_string());
    }

    if width > THUMBNAIL_MAX_DIMENSION || height > THUMBNAIL_MAX_DIMENSION {
        return Err("Video thumbnail dimensions are too large".to_string());
    }

    Ok(())
}

fn decode_video_thumbnail_data_url(thumbnail_data_url: &str) -> Result<Vec<u8>, String> {
    let (metadata, encoded_thumbnail) = thumbnail_data_url
        .split_once(',')
        .ok_or_else(|| "Video thumbnail data URL is invalid".to_string())?;

    if metadata != "data:image/jpeg;base64" {
        return Err("Video thumbnail format is unsupported".to_string());
    }

    let thumbnail = BASE64_STANDARD
        .decode(encoded_thumbnail)
        .map_err(|error| format!("Failed to decode video thumbnail: {error}"))?;

    if thumbnail.is_empty() {
        return Err("Video thumbnail is empty".to_string());
    }

    if thumbnail.len() > MAX_VIDEO_THUMBNAIL_CACHE_BYTES {
        return Err("Video thumbnail is too large".to_string());
    }

    Ok(thumbnail)
}

fn get_cached_video_thumbnail_file(
    cache_dir: PathBuf,
    path: String,
    modified_time: u64,
    size: u64,
    width: u32,
    height: u32,
) -> Result<Option<String>, String> {
    validate_video_thumbnail_size(width, height)?;

    let thumbnail_path =
        video_thumbnail_cache_path(&cache_dir, &path, modified_time, size, width, height);

    if thumbnail_path.exists() {
        return Ok(Some(thumbnail_path.to_string_lossy().to_string()));
    }

    Ok(None)
}

fn cache_video_thumbnail_file(
    cache_dir: PathBuf,
    path: String,
    modified_time: u64,
    size: u64,
    width: u32,
    height: u32,
    thumbnail_data_url: String,
) -> Result<String, String> {
    validate_video_thumbnail_size(width, height)?;

    let source_metadata = fs::metadata(Path::new(&path))
        .map_err(|error| format!("Failed to read video metadata: {error}"))?;

    if !source_metadata.is_file() {
        return Err("Video thumbnail source is not a file".to_string());
    }

    fs::create_dir_all(&cache_dir)
        .map_err(|error| format!("Failed to create thumbnail cache directory: {error}"))?;

    let thumbnail_path =
        video_thumbnail_cache_path(&cache_dir, &path, modified_time, size, width, height);

    {
        let _cache_file_lock = IMAGE_THUMBNAIL_CACHE_FILE_LOCK
            .lock()
            .map_err(|error| format!("Failed to lock thumbnail cache files: {error}"))?;

        if should_enforce_thumbnail_cache_limits()? {
            enforce_thumbnail_cache_limits(&cache_dir)?;
        }

        if thumbnail_path.exists() {
            return Ok(thumbnail_path.to_string_lossy().to_string());
        }
    }

    let thumbnail = decode_video_thumbnail_data_url(&thumbnail_data_url)?;
    let temporary_path = temporary_thumbnail_path(&thumbnail_path);

    if let Err(error) = fs::write(&temporary_path, thumbnail) {
        let _ = fs::remove_file(&temporary_path);
        return Err(format!("Failed to write video thumbnail: {error}"));
    }

    {
        let _cache_file_lock = IMAGE_THUMBNAIL_CACHE_FILE_LOCK
            .lock()
            .map_err(|error| format!("Failed to lock thumbnail cache files: {error}"))?;

        if thumbnail_path.exists() {
            let _ = fs::remove_file(&temporary_path);
            return Ok(thumbnail_path.to_string_lossy().to_string());
        }

        if let Err(error) = fs::rename(&temporary_path, &thumbnail_path) {
            let _ = fs::remove_file(&temporary_path);
            return Err(format!("Failed to finalize video thumbnail: {error}"));
        }

        record_generated_thumbnail()?;
    }

    Ok(thumbnail_path.to_string_lossy().to_string())
}

fn generate_image_thumbnail_file(
    cache_dir: PathBuf,
    path: String,
    modified_time: u64,
    size: u64,
    max_dimension: u32,
) -> Result<String, String> {
    let source_path = Path::new(&path);
    let source_metadata = fs::metadata(source_path)
        .map_err(|error| format!("Failed to read image metadata: {error}"))?;

    if !source_metadata.is_file() {
        return Err("Thumbnail source is not a file".to_string());
    }

    fs::create_dir_all(&cache_dir)
        .map_err(|error| format!("Failed to create thumbnail cache directory: {error}"))?;

    let canonical_source_path = source_path
        .canonicalize()
        .map_err(|error| format!("Failed to resolve image thumbnail source: {error}"))?;
    let canonical_cache_dir = cache_dir
        .canonicalize()
        .map_err(|error| format!("Failed to resolve thumbnail cache directory: {error}"))?;

    if path_is_same_or_descendant(&canonical_source_path, &canonical_cache_dir) {
        return Ok(canonical_source_path.to_string_lossy().to_string());
    }

    let thumbnail_path =
        thumbnail_cache_path(&cache_dir, &path, modified_time, size, max_dimension);

    {
        let _cache_file_lock = IMAGE_THUMBNAIL_CACHE_FILE_LOCK
            .lock()
            .map_err(|error| format!("Failed to lock thumbnail cache files: {error}"))?;

        if should_enforce_thumbnail_cache_limits()? {
            enforce_thumbnail_cache_limits(&cache_dir)?;
        }

        if thumbnail_path.exists() {
            return Ok(thumbnail_path.to_string_lossy().to_string());
        }
    }

    let (source_width, source_height) = image_dimensions(source_path)?;
    validate_image_thumbnail_source(source_metadata.len(), source_width, source_height)?;

    if should_use_original_image_thumbnail(
        source_path,
        source_metadata.len(),
        source_width,
        source_height,
        max_dimension,
    ) {
        return Ok(canonical_source_path.to_string_lossy().to_string());
    }

    let image = decode_image_thumbnail_source(source_path)?;
    let thumbnail = image.resize(max_dimension, max_dimension, IMAGE_THUMBNAIL_RESIZE_FILTER);
    let temporary_path = temporary_thumbnail_path(&thumbnail_path);

    if let Err(error) = write_image_thumbnail(&thumbnail, &temporary_path) {
        let _ = fs::remove_file(&temporary_path);
        return Err(error);
    }

    {
        let _cache_file_lock = IMAGE_THUMBNAIL_CACHE_FILE_LOCK
            .lock()
            .map_err(|error| format!("Failed to lock thumbnail cache files: {error}"))?;

        if thumbnail_path.exists() {
            let _ = fs::remove_file(&temporary_path);
            return Ok(thumbnail_path.to_string_lossy().to_string());
        }

        if let Err(error) = fs::rename(&temporary_path, &thumbnail_path) {
            let _ = fs::remove_file(&temporary_path);
            return Err(format!("Failed to finalize image thumbnail: {error}"));
        }

        record_generated_thumbnail()?;
    }

    Ok(thumbnail_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn generate_image_thumbnail(
    app: tauri::AppHandle,
    path: String,
    modified_time: u64,
    size: u64,
    max_dimension: Option<u32>,
) -> Result<String, String> {
    let cache_dir = thumbnail_cache_dir(&app)?;
    let max_dimension = normalize_thumbnail_max_dimension(max_dimension);

    tauri::async_runtime::spawn_blocking(move || {
        generate_image_thumbnail_file(cache_dir, path, modified_time, size, max_dimension)
    })
    .await
    .map_err(|error| format!("Failed to generate image thumbnail: {error}"))?
}

#[tauri::command]
pub async fn get_cached_video_thumbnail(
    app: tauri::AppHandle,
    path: String,
    modified_time: u64,
    size: u64,
    width: u32,
    height: u32,
) -> Result<Option<String>, String> {
    let cache_dir = thumbnail_cache_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || {
        get_cached_video_thumbnail_file(cache_dir, path, modified_time, size, width, height)
    })
    .await
    .map_err(|error| format!("Failed to get cached video thumbnail: {error}"))?
}

#[tauri::command]
pub async fn cache_video_thumbnail(
    app: tauri::AppHandle,
    path: String,
    modified_time: u64,
    size: u64,
    width: u32,
    height: u32,
    thumbnail_data_url: String,
) -> Result<String, String> {
    let cache_dir = thumbnail_cache_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || {
        cache_video_thumbnail_file(
            cache_dir,
            path,
            modified_time,
            size,
            width,
            height,
            thumbnail_data_url,
        )
    })
    .await
    .map_err(|error| format!("Failed to cache video thumbnail: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::{
        enforce_thumbnail_cache_limits, generate_image_thumbnail_file,
        normalize_thumbnail_max_dimension, path_is_same_or_descendant, thumbnail_cache_key,
        thumbnail_cache_stats, validate_image_thumbnail_source,
        MAX_ORIGINAL_IMAGE_THUMBNAIL_SOURCE_SIZE_BYTES, MAX_THUMBNAIL_CACHE_ITEM_COUNT,
        MAX_THUMBNAIL_CACHE_SIZE_BYTES, MAX_THUMBNAIL_SOURCE_FILE_SIZE_BYTES,
        MAX_THUMBNAIL_SOURCE_PIXELS, THUMBNAIL_MAX_DIMENSION,
    };
    use std::fs;
    use std::fs::File;
    use std::path::Path;

    fn write_test_png(path: &Path, width: u32, height: u32) {
        let image = image::RgbaImage::from_pixel(width, height, image::Rgba([32, 64, 96, 255]));
        image
            .save_with_format(path, image::ImageFormat::Png)
            .unwrap();
    }

    fn write_test_bmp(path: &Path, width: u32, height: u32) {
        let image = image::RgbaImage::from_pixel(width, height, image::Rgba([32, 64, 96, 255]));
        image
            .save_with_format(path, image::ImageFormat::Bmp)
            .unwrap();
    }

    fn write_test_tiff(path: &Path, width: u32, height: u32) {
        let image = image::RgbaImage::from_pixel(width, height, image::Rgba([32, 64, 96, 255]));
        image
            .save_with_format(path, image::ImageFormat::Tiff)
            .unwrap();
    }

    #[test]
    fn thumbnail_cache_key_changes_when_metadata_changes() {
        let first_key = thumbnail_cache_key("C:/photos/image.jpg", 100, 200, 384);
        let second_key = thumbnail_cache_key("C:/photos/image.jpg", 101, 200, 384);
        let third_key = thumbnail_cache_key("C:/photos/image.jpg", 100, 201, 384);

        assert_ne!(first_key, second_key);
        assert_ne!(first_key, third_key);
    }

    #[test]
    fn thumbnail_dimension_is_fixed() {
        assert_eq!(
            normalize_thumbnail_max_dimension(None),
            THUMBNAIL_MAX_DIMENSION
        );
        assert_eq!(
            normalize_thumbnail_max_dimension(Some(1)),
            THUMBNAIL_MAX_DIMENSION
        );
        assert_eq!(
            normalize_thumbnail_max_dimension(Some(10_000)),
            THUMBNAIL_MAX_DIMENSION
        );
    }

    #[test]
    fn thumbnail_cache_descendant_paths_are_detected() {
        assert!(path_is_same_or_descendant(
            Path::new("/tmp/sigma/image-thumbnails/thumb.png"),
            Path::new("/tmp/sigma/image-thumbnails")
        ));
        assert!(path_is_same_or_descendant(
            Path::new("/tmp/sigma/image-thumbnails"),
            Path::new("/tmp/sigma/image-thumbnails")
        ));
        assert!(!path_is_same_or_descendant(
            Path::new("/tmp/sigma/photo.png"),
            Path::new("/tmp/sigma/image-thumbnails")
        ));
    }

    #[test]
    fn thumbnail_cache_images_return_source_path() {
        let temp_dir = tempfile::tempdir().unwrap();
        let thumbnail_path = temp_dir.path().join("thumb.png");
        fs::write(&thumbnail_path, b"not decoded").unwrap();

        let result = generate_image_thumbnail_file(
            temp_dir.path().to_path_buf(),
            thumbnail_path.to_string_lossy().to_string(),
            100,
            11,
            384,
        )
        .unwrap();

        assert_eq!(
            result,
            thumbnail_path.canonicalize().unwrap().to_string_lossy()
        );
    }

    #[test]
    fn small_thumbnail_sources_return_source_path() {
        let temp_dir = tempfile::tempdir().unwrap();
        let source_path = temp_dir.path().join("source.png");
        let cache_dir = temp_dir.path().join("cache");
        write_test_png(&source_path, 128, 128);

        let result = generate_image_thumbnail_file(
            cache_dir.clone(),
            source_path.to_string_lossy().to_string(),
            100,
            source_path.metadata().unwrap().len(),
            THUMBNAIL_MAX_DIMENSION,
        )
        .unwrap();

        assert_eq!(
            result,
            source_path.canonicalize().unwrap().to_string_lossy()
        );
        assert_eq!(thumbnail_cache_stats(&cache_dir).unwrap().item_count, 0);
    }

    #[test]
    fn small_tiff_sources_generate_cached_png() {
        let temp_dir = tempfile::tempdir().unwrap();
        let source_path = temp_dir.path().join("source.tiff");
        let cache_dir = temp_dir.path().join("cache");
        write_test_tiff(&source_path, 128, 128);

        let result = generate_image_thumbnail_file(
            cache_dir.clone(),
            source_path.to_string_lossy().to_string(),
            100,
            source_path.metadata().unwrap().len(),
            THUMBNAIL_MAX_DIMENSION,
        )
        .unwrap();

        assert_ne!(
            result,
            source_path.canonicalize().unwrap().to_string_lossy()
        );
        assert!(result.ends_with(".png"));
        assert_eq!(thumbnail_cache_stats(&cache_dir).unwrap().item_count, 1);
    }

    #[test]
    fn small_dimension_large_sources_generate_cached_png() {
        let temp_dir = tempfile::tempdir().unwrap();
        let source_path = temp_dir.path().join("source.bmp");
        let cache_dir = temp_dir.path().join("cache");
        write_test_bmp(&source_path, 384, 384);
        assert!(
            source_path.metadata().unwrap().len() > MAX_ORIGINAL_IMAGE_THUMBNAIL_SOURCE_SIZE_BYTES
        );

        let result = generate_image_thumbnail_file(
            cache_dir.clone(),
            source_path.to_string_lossy().to_string(),
            100,
            source_path.metadata().unwrap().len(),
            THUMBNAIL_MAX_DIMENSION,
        )
        .unwrap();

        assert_ne!(
            result,
            source_path.canonicalize().unwrap().to_string_lossy()
        );
        assert!(result.ends_with(".png"));
        assert_eq!(thumbnail_cache_stats(&cache_dir).unwrap().item_count, 1);
    }

    #[test]
    fn thumbnail_source_size_is_limited() {
        let result =
            validate_image_thumbnail_source(MAX_THUMBNAIL_SOURCE_FILE_SIZE_BYTES + 1, 100, 100);

        assert!(result.is_err());
    }

    #[test]
    fn thumbnail_source_dimensions_are_limited() {
        let oversized_height = (MAX_THUMBNAIL_SOURCE_PIXELS / 100) + 1;
        let result = validate_image_thumbnail_source(1024, 100, oversized_height as u32);

        assert!(result.is_err());
    }

    #[test]
    fn thumbnail_cache_is_cleared_at_item_limit() {
        let temp_dir = tempfile::tempdir().unwrap();

        for item_index in 0..MAX_THUMBNAIL_CACHE_ITEM_COUNT {
            fs::write(temp_dir.path().join(format!("{item_index}.png")), b"thumb").unwrap();
        }

        enforce_thumbnail_cache_limits(temp_dir.path()).unwrap();

        let stats = thumbnail_cache_stats(temp_dir.path()).unwrap();
        assert_eq!(stats.item_count, 0);
        assert_eq!(stats.size_bytes, 0);
    }

    #[test]
    fn thumbnail_cache_is_cleared_above_size_limit() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file = File::create(temp_dir.path().join("large.png")).unwrap();
        file.set_len(MAX_THUMBNAIL_CACHE_SIZE_BYTES + 1).unwrap();

        enforce_thumbnail_cache_limits(temp_dir.path()).unwrap();

        let stats = thumbnail_cache_stats(temp_dir.path()).unwrap();
        assert_eq!(stats.item_count, 0);
        assert_eq!(stats.size_bytes, 0);
    }
}
