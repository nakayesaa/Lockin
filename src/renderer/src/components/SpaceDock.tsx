import { useRef } from 'react';
import type { CSSProperties } from 'react';
import type { Space } from '../../../shared/data-model';
import { ArrowLeftIcon, CloseIcon, ImageIcon, PlusIcon, TrashIcon } from './Icons';
import { spaceTone } from './spaceAppearance';

export type DraftSpace = {
  name: string;
  url: string;
  iconDataUrl: string | null;
  includeSubdomains: boolean;
  accentColor: string;
  symbol: string | null;
};

type SpaceDockProps = {
  spaces: Space[];
  allowAdding: boolean;
  editing: boolean;
  activeEditor: boolean;
  saving: boolean;
  draft: DraftSpace;
  onDraftChange: (draft: DraftSpace) => void;
  onOpen: (space: Space) => void;
  onAddRequest: () => void;
  onAddCancel: () => void;
  onAddSave: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
};

function SpaceMark({ space }: { space: Space }) {
  if (space.iconDataUrl) {
    return <img className="space-logo-image" src={space.iconDataUrl} alt="" />;
  }

  const tone = spaceTone(space);
  if (!space.symbol || tone === 'crystal') {
    return (
      <span
        className="crystal-orb"
        style={{ '--orb-accent': space.accentColor } as CSSProperties}
        aria-hidden="true"
      >
        <span />
      </span>
    );
  }

  return <span className={`space-mark space-mark--${tone}`}>{space.symbol}</span>;
}

export function SpaceDock({
  spaces,
  allowAdding,
  editing,
  activeEditor,
  saving,
  draft,
  onDraftChange,
  onOpen,
  onAddRequest,
  onAddCancel,
  onAddSave,
  onDelete,
  onMove,
}: SpaceDockProps) {
  const imageInput = useRef<HTMLInputElement>(null);

  const pickImage = (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1_000_000) {
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        onDraftChange({ ...draft, iconDataUrl: reader.result });
      }
    });
    reader.readAsDataURL(file);
  };

  return (
    <div className={`dock-wrap ${activeEditor ? 'dock-wrap--editing' : ''}`}>
      {activeEditor ? (
        <section className="space-popover" aria-label={editing ? 'Edit a space' : 'Add a space'}>
          <div className="space-popover__orb-wrap">
            <div className="space-popover__orb">
              {draft.iconDataUrl ? (
                <img src={draft.iconDataUrl} alt="Selected space logo" />
              ) : (
                <span
                  className="crystal-orb crystal-orb--large"
                  style={{ '--orb-accent': draft.accentColor } as CSSProperties}
                  aria-hidden="true"
                >
                  <span />
                </span>
              )}
            </div>
            <button
              className="orb-action orb-action--close"
              type="button"
              aria-label="Cancel adding space"
              onClick={onAddCancel}
            >
              <CloseIcon />
            </button>
            <button
              className="orb-action orb-action--image"
              type="button"
              aria-label="Choose a space logo"
              onClick={() => imageInput.current?.click()}
            >
              <ImageIcon />
            </button>
            <input
              ref={imageInput}
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => pickImage(event.target.files?.[0])}
            />
          </div>

          <div className="space-popover__form">
            <div>
              <p className="eyebrow">{editing ? 'Edit space' : 'New space'}</p>
              <h2>{editing ? 'Make it yours.' : 'Keep only what helps.'}</h2>
            </div>
            <label>
              <span>Name</span>
              <input
                value={draft.name}
                placeholder="Name from website"
                maxLength={40}
                onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
              />
            </label>
            <label>
              <span>Website</span>
              <input
                value={draft.url}
                placeholder="https://figma.com"
                inputMode="url"
                onChange={(event) => onDraftChange({ ...draft, url: event.target.value })}
              />
            </label>
            <label className="subdomain-option">
              <input
                type="checkbox"
                checked={draft.includeSubdomains}
                onChange={(event) =>
                  onDraftChange({ ...draft, includeSubdomains: event.target.checked })
                }
              />
              <span>Allow subdomains</span>
            </label>
            <div className="accent-picker" aria-label="Space color">
              {['#d9e8ff', '#b9e6d3', '#f0b84b', '#e45a68', '#20242c'].map((color) => (
                <button
                  type="button"
                  key={color}
                  className={draft.accentColor === color ? 'is-selected' : ''}
                  aria-label={`Use color ${color}`}
                  aria-pressed={draft.accentColor === color}
                  style={{ background: color }}
                  onClick={() => onDraftChange({ ...draft, accentColor: color })}
                />
              ))}
            </div>
            {editing ? (
              <div className="space-edit-actions">
                <button type="button" aria-label="Move space left" onClick={() => onMove(-1)}>
                  <ArrowLeftIcon />
                </button>
                <button type="button" aria-label="Move space right" onClick={() => onMove(1)}>
                  <ArrowLeftIcon className="move-right-icon" />
                </button>
                <button type="button" aria-label="Delete space" onClick={onDelete}>
                  <TrashIcon />
                </button>
              </div>
            ) : null}
            <button
              className="add-space-button"
              type="button"
              disabled={!draft.url.trim() || saving}
              onClick={onAddSave}
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add to focus'}
            </button>
          </div>
        </section>
      ) : null}

      <nav className="space-dock" aria-label="Allowed spaces">
        {spaces.map((space) => (
          <button
            className="space-button"
            type="button"
            key={space.id}
            aria-label={`Open ${space.name}`}
            onClick={() => onOpen(space)}
          >
            <SpaceMark space={space} />
            <span className="space-tooltip">{space.name}</span>
          </button>
        ))}
        {allowAdding ? (
          <button
            className={`space-button space-button--add ${activeEditor ? 'is-active' : ''}`}
            type="button"
            aria-label="Add an allowed website"
            aria-expanded={activeEditor}
            onClick={activeEditor ? onAddCancel : onAddRequest}
          >
            <PlusIcon />
          </button>
        ) : null}
      </nav>
    </div>
  );
}
