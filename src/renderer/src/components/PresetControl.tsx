import { useEffect, useState } from 'react';
import type { Preset, Space } from '../../../shared/data-model';
import { CheckIcon, ChevronDownIcon, CopyIcon, PlusIcon, TrashIcon } from './Icons';

interface PresetControlProps {
  readonly presets: Preset[];
  readonly spaces: Space[];
  readonly activePreset: Preset;
  readonly saving: boolean;
  readonly onSelect: (id: string) => Promise<boolean>;
  readonly onCreate: () => Promise<boolean>;
  readonly onRename: (name: string) => Promise<boolean>;
  readonly onDuplicate: () => Promise<boolean>;
  readonly onDelete: () => Promise<boolean>;
  readonly onToggleSpace: (id: string) => Promise<boolean>;
}

export function PresetControl({
  presets,
  spaces,
  activePreset,
  saving,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  onToggleSpace,
}: PresetControlProps) {
  const [open, setOpen] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const confirmingDelete = confirmingDeleteId === activePreset.id;

  useEffect(() => {
    if (!open) return;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeWithEscape);
    return () => window.removeEventListener('keydown', closeWithEscape);
  }, [open]);

  const saveName = async (value: string) => {
    const nextName = value.trim();
    if (nextName && nextName !== activePreset.name) await onRename(nextName);
  };

  return (
    <div className="preset-control">
      <button
        type="button"
        className="preset-trigger"
        aria-label={`Open preset menu. Current preset: ${activePreset.name}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="preset-trigger__dot" aria-hidden="true" />
        <span>{activePreset.name}</span>
        <ChevronDownIcon />
      </button>

      {open ? (
        <section className="preset-menu" role="dialog" aria-label="Focus presets">
          <header className="preset-menu__header">
            <div>
              <p className="eyebrow">Presets</p>
              <strong>Your focus modes</strong>
            </div>
            <button type="button" aria-label="Create preset" disabled={saving} onClick={onCreate}>
              <PlusIcon />
            </button>
          </header>

          <div className="preset-list" role="listbox" aria-label="Saved presets">
            {presets.map((preset) => (
              <button
                type="button"
                role="option"
                aria-selected={preset.id === activePreset.id}
                className={preset.id === activePreset.id ? 'is-selected' : ''}
                key={preset.id}
                disabled={saving}
                onClick={() => onSelect(preset.id)}
              >
                <span>
                  <strong>{preset.name}</strong>
                  <small>
                    {preset.durationMinutes} min · {preset.spaceIds.length}{' '}
                    {preset.spaceIds.length === 1 ? 'space' : 'spaces'}
                  </small>
                </span>
                {preset.id === activePreset.id ? <CheckIcon /> : null}
              </button>
            ))}
          </div>

          <div className="preset-editor">
            <label>
              <span>Preset name</span>
              <input
                key={`${activePreset.id}:${activePreset.name}`}
                defaultValue={activePreset.name}
                maxLength={40}
                disabled={saving}
                onBlur={(event) => void saveName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            </label>

            <div className="preset-space-picker" aria-label="Spaces in this preset">
              {spaces.map((space) => {
                const selected = activePreset.spaceIds.includes(space.id);
                return (
                  <button
                    type="button"
                    className={selected ? 'is-selected' : ''}
                    aria-pressed={selected}
                    disabled={saving}
                    key={space.id}
                    onClick={() => onToggleSpace(space.id)}
                  >
                    <span style={{ background: space.accentColor }} aria-hidden="true" />
                    {space.name}
                    {selected ? <CheckIcon /> : null}
                  </button>
                );
              })}
            </div>

            <div className="preset-menu__actions">
              <button type="button" disabled={saving} onClick={onDuplicate}>
                <CopyIcon />
                Duplicate
              </button>
              <button
                type="button"
                className={confirmingDelete ? 'is-confirming' : ''}
                disabled={saving || presets.length === 1}
                onClick={async () => {
                  if (!confirmingDelete) {
                    setConfirmingDeleteId(activePreset.id);
                    return;
                  }
                  if (await onDelete()) setConfirmingDeleteId(null);
                }}
              >
                <TrashIcon />
                {confirmingDelete ? 'Confirm delete' : 'Delete'}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
