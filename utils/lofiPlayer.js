const { spawn } = require("child_process");

const {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
} = require("@discordjs/voice");
const ffmpegPath = require("ffmpeg-static");

const logger = require("./logger");

const DEFAULT_STREAMS = [
  "https://ice1.somafm.com/groovesalad-128-mp3",
  "https://ice2.somafm.com/beatblender-128-mp3",
  "https://streams.fluxfm.de/Chillhop/mp3-128/streams.fluxfm.de/",
];

const LOFI_STREAM_URLS = String(process.env.LOFI_STREAM_URLS || process.env.LOFI_STREAM_URL || "")
  .split(",")
  .map(url => url.trim())
  .filter(Boolean);
const STREAM_URLS = LOFI_STREAM_URLS.length ? LOFI_STREAM_URLS : DEFAULT_STREAMS;

const sessions = new Map();

function stopLofi(guildId) {
  const session = sessions.get(String(guildId));
  if (!session) return false;

  sessions.delete(String(guildId));
  session.player?.stop(true);
  session.ffmpeg?.kill("SIGKILL");
  session.connection?.destroy();

  return true;
}

function createFfmpegStream(streamUrl) {
  return spawn(ffmpegPath, [
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",
    "-i", streamUrl,
    "-analyzeduration", "0",
    "-loglevel", "error",
    "-f", "s16le",
    "-ar", "48000",
    "-ac", "2",
    "pipe:1",
  ], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function waitForPlayback(player, ffmpeg, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stderr = "";

    const cleanup = () => {
      clearTimeout(timer);
      player.off(AudioPlayerStatus.Playing, onPlaying);
      player.off("error", onError);
      ffmpeg.off("exit", onExit);
      ffmpeg.stderr?.off("data", onStderr);
    };

    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };

    const onPlaying = () => done(resolve);
    const onError = err => done(reject, err);
    const onExit = code => done(reject, new Error(`ffmpeg encerrou antes de tocar (codigo ${code}). ${stderr}`.trim()));
    const onStderr = chunk => {
      stderr = `${stderr}${chunk}`.slice(-800);
    };
    const timer = setTimeout(() => {
      done(reject, new Error("Tempo limite ao iniciar audio lo-fi."));
    }, timeoutMs);

    player.once(AudioPlayerStatus.Playing, onPlaying);
    player.once("error", onError);
    ffmpeg.once("exit", onExit);
    ffmpeg.stderr?.on("data", onStderr);
  });
}

async function playLofi(channel) {
  if (!channel?.guild) throw new Error("Canal de voz inválido.");

  stopLofi(channel.guild.id);

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 15000);

  let lastError = null;

  for (const streamUrl of STREAM_URLS) {
    const ffmpeg = createFfmpegStream(streamUrl);
    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });

    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
    });

    const session = {
      channelId: channel.id,
      connection,
      ffmpeg,
      player,
      streamUrl,
    };

    try {
      player.play(resource);
      connection.subscribe(player);
      await waitForPlayback(player, ffmpeg);

      sessions.set(String(channel.guild.id), session);

      player.on(AudioPlayerStatus.Idle, () => {
        if (sessions.get(String(channel.guild.id)) === session) {
          stopLofi(channel.guild.id);
        }
      });

      player.on("error", err => {
        logger.error("Erro no player lo-fi", err);
        if (sessions.get(String(channel.guild.id)) === session) {
          stopLofi(channel.guild.id);
        }
      });

      connection.on(VoiceConnectionStatus.Disconnected, () => {
        if (sessions.get(String(channel.guild.id)) === session) {
          stopLofi(channel.guild.id);
        }
      });

      return {
        channelId: channel.id,
        streamUrl,
      };
    } catch (err) {
      lastError = err;
      player.stop(true);
      ffmpeg.kill("SIGKILL");
      logger.warn("Stream lo-fi indisponivel, tentando fallback", { streamUrl, error: err.message });
    }
  }

  connection.destroy();
  throw lastError || new Error("Nenhum stream lo-fi disponivel.");
}

module.exports = {
  STREAM_URLS,
  playLofi,
  stopLofi,
};
