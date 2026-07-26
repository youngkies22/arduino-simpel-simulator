import { CirclePlay, ExternalLink, Music, Send, User, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface SocialLink {
  icon: typeof Music;
  color: string;
  label: string;
  value: string;
  href: string;
}

const SOCIAL_LINKS: SocialLink[] = [
  { icon: Music, color: '#f472b6', label: 'TikTok', value: '@mryes.22', href: 'https://www.tiktok.com/@mryes.22' },
  { icon: CirclePlay, color: '#f87171', label: 'YouTube', value: '@codeteamwj', href: 'https://www.youtube.com/@codeteamwj' },
  { icon: Send, color: '#38bdf8', label: 'Telegram', value: '@mryes22', href: 'https://t.me/mryes22' },
];

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Dialog info pengembang, dibuka dari ikon profil di toolbar. */
export function ProfileDialog({ open, onClose }: ProfileDialogProps) {
  if (!open) return null;

  return createPortal(
    <div className="profile-dialog-overlay" onClick={onClose}>
      <div className="profile-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="profile-dialog__header">
          <span className="profile-dialog__avatar">
            <User size={20} />
          </span>
          <div className="profile-dialog__title">
            <span className="profile-dialog__name">mryes</span>
            <span className="profile-dialog__role">Pengembang Arduino Simulator</span>
          </div>
          <button type="button" className="profile-dialog__close" onClick={onClose} aria-label="Tutup">
            <X size={16} />
          </button>
        </header>

        <div className="profile-dialog__body">
          <div className="profile-dialog__badge">
            Guru Koding
            <br />
            SMK BUDI UTOMO WAY JEPARA
          </div>

          <div className="profile-dialog__links">
            {SOCIAL_LINKS.map(({ icon: Icon, color, label, value, href }) => (
              <a key={label} className="profile-dialog__link" href={href} target="_blank" rel="noreferrer">
                <Icon size={18} color={color} />
                <span className="profile-dialog__link-label">{label}</span>
                <span className="profile-dialog__link-value" style={{ color }}>
                  {value}
                </span>
                <ExternalLink size={13} className="profile-dialog__link-go" />
              </a>
            ))}
          </div>
        </div>

        <footer className="profile-dialog__footer">
          <button type="button" className="profile-dialog__done" onClick={onClose}>
            Tutup
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
