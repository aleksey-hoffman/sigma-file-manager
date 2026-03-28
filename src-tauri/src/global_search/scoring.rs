// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

pub(super) fn calculate_similarity_score(query: &str, name: &str) -> f32 {
    let query_lower = query.to_lowercase();
    let name_lower = name.to_lowercase();

    if name_lower == query_lower {
        return 1.0;
    }

    if name_lower.starts_with(&query_lower) {
        return 0.95 + (query_lower.len() as f32 / name_lower.len() as f32) * 0.05;
    }

    if name_lower.contains(&query_lower) {
        return 0.8 + (query_lower.len() as f32 / name_lower.len() as f32) * 0.15;
    }

    let query_tokens: Vec<&str> = query_lower
        .split(|c: char| c.is_whitespace() || c == '.' || c == '_' || c == '-')
        .filter(|segment| !segment.is_empty())
        .collect();

    let name_tokens: Vec<&str> = name_lower
        .split(|c: char| c.is_whitespace() || c == '.' || c == '_' || c == '-')
        .filter(|segment| !segment.is_empty())
        .collect();

    if !query_tokens.is_empty() && !name_tokens.is_empty() {
        let mut matched_count = 0;
        let mut partial_match_score = 0.0f32;

        for query_token in &query_tokens {
            let mut best_token_score = 0.0f32;

            for name_token in &name_tokens {
                if *name_token == *query_token {
                    best_token_score = 1.0;
                    break;
                } else if name_token.starts_with(query_token) {
                    best_token_score = best_token_score.max(0.9);
                } else if name_token.contains(query_token) {
                    best_token_score = best_token_score.max(0.8);
                } else {
                    let query_chars: Vec<char> = query_token.chars().collect();
                    let name_chars: Vec<char> = name_token.chars().collect();
                    if !query_chars.is_empty() && !name_chars.is_empty() {
                        let distance = levenshtein_distance(&query_chars, &name_chars);
                        let max_len = query_chars.len().max(name_chars.len());
                        if distance <= 2 && max_len > 0 {
                            let similarity = 1.0 - (distance as f32 / max_len as f32);
                            best_token_score = best_token_score.max(similarity * 0.7);
                        }
                    }
                }
            }

            if best_token_score > 0.5 {
                matched_count += 1;
            }
            partial_match_score += best_token_score;
        }

        let match_ratio = matched_count as f32 / query_tokens.len() as f32;
        let avg_token_score = partial_match_score / query_tokens.len() as f32;

        if match_ratio >= 0.5 {
            return 0.6 + (match_ratio * 0.2) + (avg_token_score * 0.15);
        }
    }

    let query_chars: Vec<char> = query_lower.chars().collect();
    let name_chars: Vec<char> = name_lower.chars().collect();

    if query_chars.is_empty() || name_chars.is_empty() {
        return 0.0;
    }

    let distance = levenshtein_distance(&query_chars, &name_chars);
    let max_len = query_chars.len().max(name_chars.len()) as f32;
    let similarity = 1.0 - (distance as f32 / max_len);

    similarity.max(0.0)
}

fn levenshtein_distance(first: &[char], second: &[char]) -> usize {
    let len_first = first.len();
    let len_second = second.len();

    if len_first == 0 {
        return len_second;
    }
    if len_second == 0 {
        return len_first;
    }

    let mut previous_row: Vec<usize> = (0..=len_second).collect();
    let mut current_row: Vec<usize> = vec![0; len_second + 1];

    for row_idx in 1..=len_first {
        current_row[0] = row_idx;

        for col_idx in 1..=len_second {
            let cost = if first[row_idx - 1] == second[col_idx - 1] {
                0
            } else {
                1
            };

            current_row[col_idx] = (previous_row[col_idx] + 1)
                .min(current_row[col_idx - 1] + 1)
                .min(previous_row[col_idx - 1] + cost);
        }

        std::mem::swap(&mut previous_row, &mut current_row);
    }

    previous_row[len_second]
}

pub(super) fn get_min_score_for_query_length(query_len: usize) -> f32 {
    match query_len {
        1..=3 => 0.9,
        4..=6 => 0.65,
        7..=9 => 0.55,
        _ => 0.5,
    }
}
