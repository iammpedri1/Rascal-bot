#![deny(clippy::unwrap_used)]

use napi_derive::napi;

#[napi]
pub fn normalize_content(content: String) -> String {
    rascal_core::normalize_content(&content)
}
