import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const dates = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const weekdays = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
});

export const money = (amount) => (amount < 0 ? '−Rp' : 'Rp') + rupiah.format(Math.abs(amount));
export const dateLabel = (value) => dates.format(new Date(value + 'T12:00:00Z'));
export const dayLabel = (value) => weekdays.format(new Date(value + 'T12:00:00Z'));
export const numberField = (value) => value === '' ? null : Number(value);
export const newId = () => crypto.randomUUID();

export async function api(path, body, signal) {
  const response = await fetch('/api/' + path, {
    ...(body === undefined ? {} : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    signal,
  });
  if (!response.ok) {
    if (response.status === 422) throw new Error('Periksa kembali nominal dan tanggal yang dimasukkan.');
    throw new Error('Data belum bisa diproses. Coba lagi.');
  }
  return response.json();
}

export function errorText(error) {
  return error instanceof TypeError ? 'Koneksi terputus. Coba lagi.' : error.message;
}

export function Field({ label, children, hint }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function MoneyInput({ value, onChange, min = 0, required = false, placeholder, inputRef }) {
  return (
    <span className="money-input">
      <span aria-hidden="true">Rp</span>
      <input
        type="number" inputMode="numeric" step="1" min={min} max="1000000000000" required={required}
        value={value ?? ''} onChange={(event) => onChange(numberField(event.target.value))}
        placeholder={placeholder} ref={inputRef}
      />
    </span>
  );
}

export function Meter({ value, total, tone = 'green', label }) {
  const percentage = total > 0 ? Math.max(0, Math.min(100, value / total * 100)) : 0;
  return (
    <div className={'meter meter-' + tone} role="img" aria-label={label}>
      <span style={{ width: percentage + '%' }} />
    </div>
  );
}

export function Dialog({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} className="dialog" aria-labelledby="dialog-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Tutup"><X size={21} /></button>
      </div>
      {children}
    </dialog>
  );
}

export function Notice({ children, error = false }) {
  return <p className={'notice' + (error ? ' notice-error' : '')} role={error ? 'alert' : 'status'}>{children}</p>;
}

export function ExpenseFields({ expense, update, today }) {
  return (
    <div className="form-grid">
      <Field label="Nama pengeluaran">
        <input value={expense.label} maxLength={100} required pattern={'.*\\S.*'} onChange={(e) => update('label', e.target.value)} />
      </Field>
      <Field label="Jumlah">
        <MoneyInput value={expense.amount} min={1} required onChange={(value) => update('amount', value)} />
      </Field>
      <Field label="Tanggal">
        <input type="date" value={expense.on} max={today} required onChange={(e) => update('on', e.target.value)} />
      </Field>
      <Field label="Pos belanja">
        <select value={expense.bucket} onChange={(e) => update('bucket', e.target.value)}>
          <option value="flexible">Fleksibel</option><option value="essential">Kebutuhan</option>
        </select>
      </Field>
    </div>
  );
}
