import React, { useState } from 'react';

// Regex para extraer ID de vídeo de YouTube (soporta estándar, shorts, youtu.be, embed)
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;

// Regex para extraer ID de vídeo de Vimeo
const VIMEO_REGEX = /(?:vimeo\.com\/)(\d+)/i;

// Regex general para URLs web
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

/**
 * Detecta información de vídeo embebible a partir de una URL
 */
export function extractVideoInfo(url) {
  if (!url || typeof url !== 'string') return null;

  const ytMatch = url.match(YOUTUBE_REGEX);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      id: ytMatch[1],
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`
    };
  }

  const vimeoMatch = url.match(VIMEO_REGEX);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo',
      id: vimeoMatch[1],
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`
    };
  }

  return null;
}

/**
 * Busca todos los vídeos válidos en un texto
 */
export function findVideosInText(text) {
  if (!text) return [];
  const matches = text.match(URL_REGEX) || [];
  const videos = [];
  const seenIds = new Set();

  for (const url of matches) {
    const video = extractVideoInfo(url);
    if (video && !seenIds.has(video.id)) {
      seenIds.add(video.id);
      videos.push(video);
    }
  }

  return videos;
}

/**
 * Componente de reproductor de vídeo responsive 16:9 con opción de plegado y SVGs integrados
 */
export function VideoEmbedPlayer({ video, initialOpen = true }) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  if (!video) return null;

  return (
    <div style={{ marginTop: '0.8rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.55rem 0.8rem',
          background: 'rgba(255, 255, 255, 0.05)',
          border: 'none',
          color: '#ffffff',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: 600,
          textAlign: 'left'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-primary)' }}>
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <span>{video.type === 'youtube' ? 'Vídeo Tutorial (YouTube)' : 'Vídeo Tutorial (Vimeo)'}</span>
        </span>
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div style={{ padding: '0.6rem' }}>
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            borderRadius: '6px',
            overflow: 'hidden',
            background: '#000000',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <iframe
              src={video.embedUrl}
              title="Reproductor de vídeo de la actividad"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 0
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Renderiza el texto de descripción convirtiendo URLs en enlaces seguros con SVG y respetando saltos de línea
 */
export function FormattedDescriptionText({ text }) {
  if (!text) return null;

  // Dividir el texto conservando las URLs
  const lines = text.split('\n');

  const renderLine = (line, lineIdx) => {
    if (!line.trim()) {
      return <div key={lineIdx} style={{ height: '0.4rem' }} />;
    }

    const parts = line.split(URL_REGEX);

    return (
      <div key={lineIdx} style={{ minHeight: '1.2rem', wordBreak: 'break-word', lineHeight: '1.45' }}>
        {parts.map((part, partIdx) => {
          if (part.match(URL_REGEX)) {
            const isVideo = !!extractVideoInfo(part);
            const shortLabel = part.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40) + (part.length > 50 ? '...' : '');

            return (
              <a
                key={partIdx}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'var(--accent-primary)',
                  textDecoration: 'underline',
                  wordBreak: 'break-all',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  margin: '0 2px'
                }}
              >
                {isVideo ? (
                  <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                )}
                <span>{shortLabel}</span>
              </a>
            );
          }
          return <span key={partIdx}>{part}</span>;
        })}
      </div>
    );
  };

  return (
    <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
      {lines.map((line, idx) => renderLine(line, idx))}
    </div>
  );
}
