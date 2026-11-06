use poise::CreateReply;
use poise::serenity_prelude as serenity;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use sysinfo::System;

pub struct Data {
    pub start_time: SystemTime,
}

type Error = Box<dyn std::error::Error + Send + Sync>;
type Context<'a> = poise::Context<'a, Data, Error>;

fn format_uptime(duration: Duration) -> String {
    let mut remaining = duration.as_secs();
    let units = [
        (30 * 86400, "mês", "meses"),
        (7 * 86400, "semana", "semanas"),
        (86400, "dia", "dias"),
        (3600, "hora", "horas"),
        (60, "minuto", "minutos"),
        (1, "segundo", "segundos"),
    ];

    let mut parts = Vec::new();
    for (seconds, singular, plural) in units {
        let value = remaining / seconds;
        remaining %= seconds;
        if value > 0 {
            let label = if value == 1 { singular } else { plural };
            parts.push(format!("{} {}", value, label));
        }
    }

    if parts.is_empty() {
        "0 segundos".to_string()
    } else {
        parts.join(", ")
    }
}

fn format_bytes(bytes: u64) -> String {
    if bytes == 0 {
        return "0 B".to_string();
    }
    let k = 1024_f64;
    let sizes = ["B", "KB", "MB", "GB", "TB"];
    let i = (bytes as f64).log(k).floor() as usize;
    format!("{:.2} {}", (bytes as f64) / k.powi(i as i32), sizes[i])
}

#[poise::command(slash_command, category = "system")]
pub async fn ping(ctx: Context<'_>) -> Result<(), Error> {
    let started_at = Instant::now();

    ctx.defer().await?;

    let response_time = started_at.elapsed().as_millis();

    let shard_manager = ctx.framework().shard_manager();
    let runners = shard_manager.runners.lock().await;
    let api_ping = match runners.get(&ctx.serenity_context().shard_id) {
        Some(runner) => runner
            .latency
            .map(|l| format!("`{}ms`", l.as_millis()))
            .unwrap_or_else(|| "Reconectando...".to_string()),
        None => "Desconhecido".to_string(),
    };

    let start_time = ctx.data().start_time;
    let uptime_duration = start_time.elapsed().unwrap_or_default();
    let started_timestamp = start_time.duration_since(UNIX_EPOCH).unwrap().as_secs();

    let mut sys = System::new();
    let pid = sysinfo::get_current_pid().unwrap();
    sys.refresh_processes();

    let memory_rss = if let Some(process) = sys.process(pid) {
        process.memory()
    } else {
        0
    };

    let content = format!(
        "🏓 <@{}> Latência verificada com sucesso.\n\
        🌐 **Latência da API:** {}\n\
        <a:in_engrenagemGirando:1499799730585207038> **Resposta:** `{}ms`\n\
        <a:clock:1500276315981353021> **Uptime:** {} (online <t:{}:R>)\n\
        <:Ram:1506433310291660972> **Memória RAM:** {}",
        ctx.author().id,
        api_ping,
        response_time,
        format_uptime(uptime_duration),
        started_timestamp,
        format_bytes(memory_rss)
    );

    ctx.send(CreateReply::default().content(content)).await?;

    Ok(())
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let token = std::env::var("DISCORD_TOKEN").expect("Faltando DISCORD_TOKEN no .env");

    let framework = poise::Framework::builder()
        .options(poise::FrameworkOptions {
            commands: vec![ping()],
            ..Default::default()
        })
        .setup(|ctx, _ready, framework| {
            Box::pin(async move {
                poise::builtins::register_globally(ctx, &framework.options().commands).await?;
                println!("✅ Bot iniciado! Todos os comandos registrados.");

                Ok(Data {
                    start_time: SystemTime::now(),
                })
            })
        })
        .build();

    let mut client = serenity::ClientBuilder::new(token, serenity::GatewayIntents::empty())
        .framework(framework)
        .await
        .unwrap();

    if let Err(why) = client.start().await {
        println!("Erro fatal: {:?}", why);
    }
}
