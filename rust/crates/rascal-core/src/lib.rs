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

#[derive(Debug, PartialEq, Eq)]
pub struct WorkRoll {
    pub event: &'static str,
    pub profession_index: usize,
    pub base_reward: i32,
    pub loss: i32,
    pub bonus: i32,
    pub critical: bool,
}

const WORK_PROFESSIONS: [(i32, i32); 30] = [
    (800, 1500),
    (1500, 3000),
    (700, 1200),
    (5000, 10000),
    (2000, 4500),
    (2500, 5000),
    (100, 8000),
    (600, 1100),
    (800, 1600),
    (1000, 2500),
    (1200, 3000),
    (50, 9000),
    (900, 2200),
    (500, 1000),
    (700, 1400),
    (3000, 7000),
    (4000, 8000),
    (2000, 4000),
    (1200, 2500),
    (900, 2000),
    (1100, 2400),
    (300, 5000),
    (500, 7000),
    (1800, 3500),
    (2200, 4800),
    (600, 1200),
    (1500, 2800),
    (2000, 4200),
    (1100, 2600),
    (500, 1000),
];

fn random_amount(value: f64, minimum: i32, maximum: i32) -> i32 {
    minimum + (value.clamp(0.0, 0.999_999) * f64::from(maximum - minimum + 1)) as i32
}

pub fn resolve_work_roll(
    roll: f64,
    profession_roll: f64,
    reward_roll: f64,
    bonus_roll: f64,
    loss_roll: f64,
    tool_loss_roll: f64,
) -> WorkRoll {
    let profession_index =
        (profession_roll.clamp(0.0, 0.999_999) * WORK_PROFESSIONS.len() as f64) as usize;

    if roll < 0.15 {
        return WorkRoll {
            event: "dismissal",
            profession_index,
            base_reward: 0,
            loss: random_amount(loss_roll, 300, 800),
            bonus: 0,
            critical: false,
        };
    }

    if roll >= 0.90 {
        return WorkRoll {
            event: "tool_break",
            profession_index,
            base_reward: 0,
            loss: random_amount(tool_loss_roll, 100, 300),
            bonus: 0,
            critical: false,
        };
    }

    let (minimum, maximum) = WORK_PROFESSIONS[profession_index];
    let critical = roll < 0.20;
    WorkRoll {
        event: if critical { "critical" } else { "success" },
        profession_index,
        base_reward: random_amount(reward_roll, minimum, maximum),
        loss: 0,
        bonus: if critical {
            random_amount(bonus_roll, 100, 300)
        } else {
            0
        },
        critical,
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_content, resolve_work_roll};

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

    #[test]
    fn resolves_work_events_without_visual_data() {
        assert_eq!(
            resolve_work_roll(0.1, 0.0, 0.0, 0.0, 0.0, 0.0).event,
            "dismissal"
        );
        assert_eq!(
            resolve_work_roll(0.95, 0.0, 0.0, 0.0, 0.0, 0.0).event,
            "tool_break"
        );
        assert_eq!(
            resolve_work_roll(0.16, 0.0, 0.0, 0.0, 0.0, 0.0).event,
            "critical"
        );
    }
}
