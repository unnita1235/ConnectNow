/**
 * Attachment Preview Component
 * =============================================================================
 * Displays file attachments in messages with appropriate previews
 */

'use client';

import React, { useState } from 'react';
import {
  FileIcon,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  Download,
  ExternalLink,
  X,
  Play,
  Pause,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/hooks/useFileUpload';

interface Attachment {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
}

interface AttachmentPreviewProps {
  attachments: Attachment[];
  className?: string;
}

export function AttachmentPreview({ attachments, className }: AttachmentPreviewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const images = attachments.filter((a) => a.mimeType.startsWith('image/'));
  const videos = attachments.filter((a) => a.mimeType.startsWith('video/'));
  const audio = attachments.filter((a) => a.mimeType.startsWith('audio/'));
  const documents = attachments.filter(
    (a) =>
      !a.mimeType.startsWith('image/') &&
      !a.mimeType.startsWith('video/') &&
      !a.mimeType.startsWith('audio/')
  );

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Image Grid */}
      {images.length > 0 && (
        <div
          className={cn(
            'grid gap-2',
            images.length === 1 && 'grid-cols-1',
            images.length === 2 && 'grid-cols-2',
            images.length >= 3 && 'grid-cols-3'
          )}
        >
          {images.map((image, index) => (
            <button
              key={image.id}
              className="group relative aspect-video overflow-hidden rounded-md bg-muted"
              onClick={() => openLightbox(index)}
            >
              <img
                src={image.url}
                alt={image.filename}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
            </button>
          ))}
        </div>
      )}

      {/* Video Players */}
      {videos.map((video) => (
        <VideoPlayer key={video.id} video={video} />
      ))}

      {/* Audio Players */}
      {audio.map((audioFile) => (
        <AudioPlayer key={audioFile.id} audio={audioFile} />
      ))}

      {/* Document List */}
      {documents.length > 0 && (
        <div className="space-y-1">
          {documents.map((doc) => (
            <DocumentItem key={doc.id} document={doc} />
          ))}
        </div>
      )}

      {/* Image Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95">
          <DialogTitle className="sr-only">Image Preview</DialogTitle>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 z-10 text-white hover:bg-white/20"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>

            {images[lightboxIndex] && (
              <div className="flex items-center justify-center min-h-[300px] max-h-[80vh]">
                <img
                  src={images[lightboxIndex].url}
                  alt={images[lightboxIndex].filename}
                  className="max-h-[80vh] max-w-full object-contain"
                />
              </div>
            )}

            {/* Navigation */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    className={cn(
                      'h-2 w-2 rounded-full transition-colors',
                      idx === lightboxIndex ? 'bg-white' : 'bg-white/50'
                    )}
                    onClick={() => setLightboxIndex(idx)}
                  />
                ))}
              </div>
            )}

            {/* Download button */}
            {images[lightboxIndex] && (
              <div className="absolute bottom-4 right-4">
                <Button
                  variant="secondary"
                  size="sm"
                  asChild
                >
                  <a
                    href={images[lightboxIndex].url}
                    download={images[lightboxIndex].filename}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Video Player Component
 */
function VideoPlayer({ video }: { video: Attachment }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="relative max-w-md overflow-hidden rounded-md bg-black">
      <video
        ref={videoRef}
        src={video.url}
        className="w-full"
        controls
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      {!isPlaying && (
        <button
          className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/40"
          onClick={togglePlay}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
            <Play className="h-6 w-6 text-black" />
          </div>
        </button>
      )}
    </div>
  );
}

/**
 * Audio Player Component
 */
function AudioPlayer({ audio }: { audio: Attachment }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/50 p-3">
      <audio
        ref={audioRef}
        src={audio.url}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />

      <Button
        variant="secondary"
        size="icon"
        className="h-10 w-10 rounded-full"
        onClick={togglePlay}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" />
        )}
      </Button>

      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{audio.filename}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <a
        href={audio.url}
        download={audio.filename}
        className="text-muted-foreground hover:text-foreground"
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}

/**
 * Document Item Component
 */
function DocumentItem({ document }: { document: Attachment }) {
  const getIcon = () => {
    if (document.mimeType.includes('pdf')) return <FileText className="h-5 w-5" />;
    if (document.mimeType.includes('word')) return <FileText className="h-5 w-5" />;
    if (document.mimeType.includes('sheet') || document.mimeType.includes('excel'))
      return <FileText className="h-5 w-5" />;
    return <FileIcon className="h-5 w-5" />;
  };

  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-2 hover:bg-muted/50">
      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
        {getIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{document.filename}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(document.size)}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <a href={document.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <a href={document.url} download={document.filename}>
            <Download className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
