import { useEffect, useState } from 'react';
import { fetchConfig, updateConfig, type EditableConfig } from '../api';

const FIELDS: { key: keyof EditableConfig; label: string; step: number; hint: string }[] = [
  { key: 'trade_allocation_usd', label: 'Trade allocation (USD)', step: 1, hint: 'USD spent per buy' },
  { key: 'trade_cooldown_minutes', label: 'Buy cooldown (min)', step: 1, hint: 'Min minutes between buys' },
  { key: 'bounce_confirm_pct', label: 'Bounce confirmation (%)', step: 0.1, hint: '0 = buy on the trough candle; >0 = wait for price to bounce this far off the floor first' },
  { key: 'target_profit_pct', label: 'Target profit (%)', step: 0.1, hint: 'Fee-aware profit floor per lot - never sells below this' },
  { key: 'trailing_stop_pct', label: 'Trailing stop (%)', step: 0.1, hint: 'Once past target, sell on this much pullback from the lot\'s peak (0 = no trailing net)' },
];

export default function ConfigEditor() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<EditableConfig | null>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && !values) {
      fetchConfig().then(setValues).catch(e => setStatus({ kind: 'err', msg: e.message }));
    }
  }, [open, values]);

  const setField = (key: keyof EditableConfig, raw: string) => {
    setValues(v => (v ? { ...v, [key]: raw === '' ? NaN : Number(raw) } : v));
  };

  const save = async () => {
    if (!values) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await updateConfig(values);
      setStatus({ kind: 'ok', msg: res.persisted ? 'Saved (persisted).' : 'Applied live — not persisted (config.json not writable).' });
    } catch (e: any) {
      setStatus({ kind: 'err', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings">
      <button className="settings-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '▾' : '▸'} Settings
      </button>
      {open && (
        <div className="settings-body">
          {!values ? (
            <div className="empty-table">Loading…</div>
          ) : (
            <>
              <div className="settings-grid">
                {FIELDS.map(f => (
                  <label key={f.key} className="settings-field">
                    <span className="settings-label">{f.label}</span>
                    <input
                      type="number"
                      step={f.step}
                      value={Number.isNaN(values[f.key]) ? '' : values[f.key]}
                      onChange={e => setField(f.key, e.target.value)}
                    />
                    <span className="settings-hint">{f.hint}</span>
                  </label>
                ))}
              </div>
              <div className="settings-actions">
                <button className="settings-save" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {status && <span className={status.kind === 'ok' ? 'settings-ok' : 'settings-err'}>{status.msg}</span>}
              </div>
              <div className="settings-note">Changes take effect on the bot's next cycle.</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
