"use client";

import { useRef, useState } from "react";

import { PauseIcon, PlayIcon } from "./icons";

type AudioPlayProps = {
  src: string;
  label: string;
  playAriaLabel: string;
  pauseAriaLabel: string;
};

/**
 * Inline audio control for the atmosphere section — pill button with
 * play/pause toggle. Uses the same red-circle icon language as VideoPlay.
 */
export function AudioPlay({ src, label, playAriaLabel, pauseAriaLabel }: AudioPlayProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play();
    }
  };

  return (
    <>
      <button
        type="button"
        className="atmo-audio"
        onClick={toggle}
        aria-label={playing ? pauseAriaLabel : playAriaLabel}
        aria-pressed={playing}
      >
        <span className="atmo-audio__circle">
          {playing ? <PauseIcon /> : <PlayIcon />}
        </span>
        <span className="atmo-audio__label">{label}</span>
      </button>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </>
  );
}
