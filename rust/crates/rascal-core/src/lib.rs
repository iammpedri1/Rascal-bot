use unicode_normalization::UnicodeNormalization;

/// Keeps the text contract used by message replies: trim, lowercase and
/// remove combining marks after Unicode NFD normalization.
pub fn normalize_content(content: &str) -> String {
    content
        .trim()
        .nfd()
        .filter(|character| !is_combining_mark(*character))
        .collect::<String>()
        .to_lowercase()
}

fn is_combining_mark(character: char) -> bool {
    matches!(
        character as u32,
        0x0300..=0x036f
            | 0x1ab0..=0x1aff
            | 0x1dc0..=0x1dff
            | 0x20d0..=0x20ff
            | 0xfe20..=0xfe2f
    )
}

#[cfg(test)]
mod tests {
    use super::normalize_content;

    #[test]
    fn normalizes_case_spaces_and_accents() {
        assert_eq!(normalize_content("  Olá, MUNDO!  "), "ola, mundo!");
    }

    #[test]
    fn preserves_emoji_and_non_combining_unicode() {
        assert_eq!(normalize_content("  Café 🦝  "), "cafe 🦝");
    }

    #[test]
    fn accepts_empty_content() {
        assert_eq!(normalize_content(" \n\t "), "");
    }
}
