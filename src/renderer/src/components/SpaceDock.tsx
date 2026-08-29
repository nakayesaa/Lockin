import { useRef } from 'react';
import { CloseIcon, ImageIcon, PlusIcon } from './Icons';

export type Space = {
  id: string;
  name: string;
  url: string;
  mark?: string;
  logoUrl?: string | undefined;
  tone: 'amber' | 'ink' | 'rose' | 'crystal';
};

export type DraftSpace = {
  name: string;
  url: string;
  logoUrl: string | undefined;
};

type SpaceDockProps = {
  spaces: Space[];
  allowAdding: boolean;
  editing: boolean;
  activeEditor: boolean;
  draft: DraftSpace;
  onDraftChange: (draft: DraftSpace) => void;
  onOpen: (space: Space) => void;
  onAddRequest: () => void;
  onAddCancel: () => void;
  onAddSave: () => void;
};

function SpaceMark({ space }: { space: Space }) {
  if (space.logoUrl) {
    return <img className="space-logo-image" src={space.logoUrl} alt="" />;
  }

  if (space.tone === 'crystal') {
    return (
      <span className="crystal-orb" aria-hidden="true">
        <span />
      </span>
    );
  }

  return <span className={`space-mark space-mark--${space.tone}`}>{space.mark}</span>;
}

export function SpaceDock({
  spaces,
  allowAdding,
  editing,
  activeEditor,
  draft,
  onDraftChange,
  onOpen,
  onAddRequest,
  onAddCancel,
  onAddSave,
}: SpaceDockProps) {
  const imageInput = useRef<HTMLInputElement>(null);

  const pickImage = (file: File | undefined) => {
    if (!file) return;
    onDraftChange({ ...draft, logoUrl: URL.createObjectURL(file) });
  };

  return (
    <div className={`dock-wrap ${activeEditor ? 'dock-wrap--editing' : ''}`}>
      {activeEditor ? (
        <section className="space-popover" aria-label="Add a space">
          <div className="space-popover__orb-wrap">
            <div className="space-popover__orb">
              {draft.logoUrl ? (
                <img src={draft.logoUrl} alt="Selected space logo" />
              ) : (
                <span className="crystal-orb crystal-orb--large" aria-hidden="true">
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
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
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
                placeholder="Figma"
                maxLength={28}
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
            <button
              className="add-space-button"
              type="button"
              disabled={!draft.name.trim() || !draft.url.trim()}
              onClick={onAddSave}
            >
              {editing ? 'Save changes' : 'Add to focus'}
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
