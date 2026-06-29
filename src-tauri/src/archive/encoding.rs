// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use encoding_rs::Encoding;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use zip::result::ZipError;
use zip::ZipArchive;

use crate::utils::normalize_path;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveCheckResult {
    pub encrypted: bool,
    pub encoding_undetermined: bool,
    pub detected_encoding: Option<String>,
}

const MAX_ZIP_ENCODING_SAMPLES: usize = 32;

pub const ZIP_ENTRY_ENCODING_CANDIDATES: &[&str] = &[
    "shift_jis",
    "gb2312",
    "big5",
    "ks_c_5601-1987",
    "Windows-1258",
    "Windows-874",
    "Windows-1256",
    "Windows-1255",
    "Windows-1254",
    "IBM437",
    "Windows-1252",
    "Windows-1250",
    "Windows-1251",
    "Windows-1253",
    "Windows-1257",
    "macintosh",
];

fn is_zip_password_required(error: &ZipError) -> bool {
    matches!(
        error,
        ZipError::UnsupportedArchive(ZipError::PASSWORD_REQUIRED)
    )
}

fn score_encoding_for_zip_names(raw_names: &[Vec<u8>], encoding_label: &str) -> u32 {
    let Some(encoding) = Encoding::for_label(encoding_label.as_bytes()) else {
        return 0;
    };

    let mut score = 0u32;

    for raw in raw_names {
        let (_, _, had_errors) = encoding.decode(raw);
        if had_errors || decode_zip_entry_path_str(raw, encoding_label).is_err() {
            continue;
        }

        let weight = if raw.iter().any(|byte| *byte >= 0x80) {
            10
        } else {
            1
        };
        score += weight;
    }

    score
}

pub fn detect_zip_entry_encoding(raw_names: &[Vec<u8>]) -> Option<String> {
    if raw_names.is_empty() {
        return None;
    }

    let max_score: u32 = raw_names
        .iter()
        .map(|raw| {
            if raw.iter().any(|byte| *byte >= 0x80) {
                10
            } else {
                1
            }
        })
        .sum();

    let mut best_label: Option<&str> = None;
    let mut best_score = 0u32;

    for &label in ZIP_ENTRY_ENCODING_CANDIDATES {
        let score = score_encoding_for_zip_names(raw_names, label);
        if score > best_score {
            best_score = score;
            best_label = Some(label);
        }
    }

    if best_score >= max_score {
        best_label.map(str::to_string)
    } else {
        None
    }
}

pub fn decode_zip_entry_path_str(raw: &[u8], encoding: &str) -> Result<String, String> {
    if raw.contains(&0) {
        return Err("Zip entry name contains null bytes".to_string());
    }

    let enc = Encoding::for_label(encoding.as_bytes())
        .ok_or_else(|| format!("Unknown encoding: {}", encoding))?;
    let (decoded, _encoding, _had_errors) = enc.decode(raw);
    let cleaned = decoded
        .trim_start_matches(['/', '\\'])
        .trim_start_matches("./");

    if cleaned.is_empty() {
        return Err("Zip entry with empty path".to_string());
    }

    Ok(cleaned.to_string())
}

#[tauri::command]
pub fn check_archive(archive_path: String) -> Result<ArchiveCheckResult, String> {
    let path = PathBuf::from(normalize_path(&archive_path));
    let file =
        fs::File::open(&path).map_err(|error| format!("Failed to open archive: {}", error))?;
    let mut archive =
        ZipArchive::new(file).map_err(|error| format!("Failed to read archive: {}", error))?;

    let mut encrypted = false;
    let mut encoding_undetermined = false;
    let mut non_utf8_name_samples: Vec<Vec<u8>> = Vec::new();

    for index in 0..archive.len() {
        if encrypted
            && encoding_undetermined
            && non_utf8_name_samples.len() >= MAX_ZIP_ENCODING_SAMPLES
        {
            break;
        }

        let entry_result = archive.by_index(index);
        let entry = match entry_result {
            Ok(entry) => {
                if !encrypted && entry.encrypted() {
                    encrypted = true;
                }
                entry
            }
            Err(error) => {
                if is_zip_password_required(&error) {
                    encrypted = true;
                    continue;
                }

                return Err(format!("Failed to read entry: {}", error));
            }
        };

        let raw = entry.name_raw();
        if std::str::from_utf8(raw).is_err() {
            encoding_undetermined = true;
            if non_utf8_name_samples.len() < MAX_ZIP_ENCODING_SAMPLES {
                non_utf8_name_samples.push(raw.to_vec());
            }
        }
    }

    let detected_encoding = if encoding_undetermined {
        detect_zip_entry_encoding(&non_utf8_name_samples)
    } else {
        None
    };

    Ok(ArchiveCheckResult {
        encrypted,
        encoding_undetermined,
        detected_encoding,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::unstable::write::FileOptionsExt;
    use zip::write::SimpleFileOptions;
    use zip::ZipWriter;

    fn zip_file_options() -> SimpleFileOptions {
        SimpleFileOptions::default()
    }

    #[test]
    fn encoding_candidates_match_frontend_contract() {
        let expected = [
            "shift_jis",
            "gb2312",
            "big5",
            "ks_c_5601-1987",
            "Windows-1258",
            "Windows-874",
            "Windows-1256",
            "Windows-1255",
            "Windows-1254",
            "IBM437",
            "Windows-1252",
            "Windows-1250",
            "Windows-1251",
            "Windows-1253",
            "Windows-1257",
            "macintosh",
        ];

        assert_eq!(ZIP_ENTRY_ENCODING_CANDIDATES, expected);
    }

    #[test]
    fn check_archive_reports_clean_utf8_zip() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("clean.zip");
        let mut zip_writer = ZipWriter::new(fs::File::create(&zip_path).unwrap());
        let options = zip_file_options();
        zip_writer.start_file("hello.txt", options).unwrap();
        zip_writer.write_all(b"content").unwrap();
        zip_writer.finish().unwrap();

        let result = check_archive(zip_path.to_string_lossy().to_string()).unwrap();
        assert!(!result.encrypted);
        assert!(!result.encoding_undetermined);
        assert!(result.detected_encoding.is_none());
    }

    #[test]
    fn check_archive_detects_encrypted_zip_without_encoding_prompt() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("encrypted.zip");
        let mut zip_writer = ZipWriter::new(fs::File::create(&zip_path).unwrap());
        let options = zip_file_options()
            .with_deprecated_encryption(b"aaaaaa")
            .unwrap();
        zip_writer.start_file("secret.txt", options).unwrap();
        zip_writer.write_all(b"hidden").unwrap();
        zip_writer.finish().unwrap();

        let result = check_archive(zip_path.to_string_lossy().to_string()).unwrap();
        assert!(result.encrypted);
        assert!(!result.encoding_undetermined);
        assert!(result.detected_encoding.is_none());
    }

    #[test]
    fn detect_zip_entry_encoding_detects_shift_jis() {
        let raw = [0x82, 0xa0, b'.', b't', b'x', b't'];
        let samples = vec![raw.to_vec()];
        assert_eq!(
            detect_zip_entry_encoding(&samples).as_deref(),
            Some("shift_jis")
        );
    }

    #[test]
    fn decode_zip_entry_path_str_decodes_shift_jis_filename() {
        let raw = [0x82, 0xa0, b'.', b't', b'x', b't'];
        let decoded = decode_zip_entry_path_str(&raw, "shift_jis").unwrap();
        assert_eq!(decoded, "あ.txt");
    }
}
