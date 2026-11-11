import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bookmark, CalendarClock, Check, CircleHelp, ReceiptText, X } from 'lucide-react';
import { api, dateLabel, Dialog, errorText, Field, money, MoneyInput, Notice, numberField } from './shared.jsx';

const titles = { today: 'Tunai hari ini', payday: 'Tunai saat pemasukan', installment: 'Cicilan' };
const missingLabels = {
  price: 'harga tunai', payment: 'cicilan per bulan', months: 'jumlah bulan',
  first_due: 'tanggal cicilan pertama', upfront: 'total biaya awal',
};

export function offerFromPreview(preview) {
  return {
    item: preview.item, price: preview.price, bucket: preview.bucket,
    urgent: preview.urgent, pressure: preview.pressure,
    redirect_savings: false, installment: preview.installment,
  };
}

function Scenario({ option, installment, today, payday }) {
  if (option.missing) {
    return (
      <article className="scenario scenario-missing">
        <h4>{titles[option.mode]}</h4>
        <p className="scenario-main">Perlu dilengkapi</p>
        <p>Isi {option.missing.map((key) => missingLabels[key]).join(', ')}.</p>
      </article>
    );
  }
  const constrained = option.purchase_gap || option.bill_gap || option.goal_gap || option.redirected > 0;
  return (
    <article className={'scenario' + (constrained ? ' scenario-constrained' : '')}>
      <h4>{titles[option.mode]}</h4>
      <p className="scenario-main">{money(option.total)}</p>
      <p className="scenario-date">
        {option.mode === 'installment'
          ? money(installment.payment) + ' × ' + installment.months + ' bulan, mulai ' + dateLabel(installment.first_due)
          : dateLabel(option.mode === 'today' ? today : payday)}
      </p>
      <div className="scenario-lines">
        {option.mode === 'installment' && <p>Biaya awal {money(installment.upfront)}</p>}
        {option.purchase_gap && (
          <p className="warning-text"><strong>{money(option.purchase_gap.short)}</strong> di atas anggaran pada {dateLabel(option.purchase_gap.on)}.</p>
        )}
        {option.bill_gap && (
          <p className="warning-text">{option.bill_gap.label} kurang <strong>{money(option.bill_gap.short)}</strong> pada {dateLabel(option.bill_gap.on)}.</p>
        )}
        {option.goal_gap && (
          <p className="warning-text">Setoran tabungan kurang {money(option.goal_gap.short)} pada {dateLabel(option.goal_gap.on)}.</p>
        )}
        {option.redirected > 0 && <p>{money(option.redirected)} dialihkan dari rencana setoran.</p>}
        {option.goal_status === 'review' && <p>Periksa pendanaan setoran sebelum memakai perkiraan tanggal tujuan.</p>}
        {option.goal_date && (
          <p>Perkiraan tujuan {option.goal_status === 'adjusted' ? 'berubah ke ' : ''}
            <strong>{dateLabel(option.goal_date)} {option.goal_date.slice(0, 4)}</strong>.
          </p>
        )}
        {!constrained && <p className="fit-text"><Check size={15} /> Muat dalam rencana</p>}
      </div>
    </article>
  );
}

function RecordDialog({ offer, comparison, onConfirm, onClose }) {
  const canPayCash = Boolean(offer.price);
  const installmentOption = comparison.options.find((option) => option.mode === 'installment');
  const canFinance = !installmentOption.missing;
  const [method, setMethod] = useState(canPayCash ? 'cash' : 'installment');
  const terms = offer.installment;
  return (
    <Dialog title="Catat pembelian" onClose={onClose}>
      <form className="dialog-form" onSubmit={(event) => { event.preventDefault(); onConfirm(method); }}>
        <p className="dialog-item">{offer.item}</p>
        <Field label="Cara bayar">
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {canPayCash && <option value="cash">Tunai</option>}
            {canFinance && <option value="installment">Cicilan</option>}
          </select>
        </Field>
        {method === 'cash' ? <p>{money(offer.price)} masuk ke riwayat hari ini.</p> :
          <p>Biaya awal {money(terms.upfront)}. {terms.months} cicilan sebesar {money(terms.payment)}
            {' '}masuk ke jadwal tagihan, mulai {dateLabel(terms.first_due)}.</p>}
        <div className="dialog-actions">
          <button className="button button-outline" type="button" onClick={onClose}>Kembali</button>
          <button className="button button-primary" type="submit">Konfirmasi pembelian</button>
        </div>
      </form>
    </Dialog>
  );
}

export default function Purchase({ initial, savedId, budget, onSave, onRecord, onClose }) {
  const [offer, setOffer] = useState(initial);
  const [committed, setCommitted] = useState(savedId ? initial : null);
  const [result, setResult] = useState(null);
  const [state, setState] = useState(savedId ? 'loading' : 'idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showTerms, setShowTerms] = useState(Boolean(initial.installment));
  const [recording, setRecording] = useState(false);
  const [activeId, setActiveId] = useState(savedId);
  const priceRef = useRef(null);
  const dirty = !committed || JSON.stringify(committed) !== JSON.stringify(offer);
  const changed = (key, value) => {
    setOffer((current) => ({ ...current, [key]: value }));
    setMessage('');
  };
  const changeTerm = (key, value) => setOffer((current) => ({
    ...current, installment: { ...current.installment, [key]: value },
  }));

  useEffect(() => {
    if (!committed) return undefined;
    const controller = new AbortController();
    setState('loading');
    setError('');
    api('compare', { budget, offer: committed }, controller.signal).then((next) => {
      setResult(next);
      setState('ready');
    }).catch((problem) => {
      if (problem.name === 'AbortError') return;
      setError(errorText(problem));
      setState('error');
    });
    return () => controller.abort();
  }, [budget, committed]);

  const submit = (event) => {
    event.preventDefault();
    if (!offer.item.trim() || (!offer.price && !offer.installment?.payment)) {
      setError('Isi nama barang dan harga tunai atau nominal cicilan.');
      return;
    }
    setMessage('');
    setCommitted({ ...offer, item: offer.item.trim() });
    if (offer.item !== offer.item.trim()) setOffer({ ...offer, item: offer.item.trim() });
  };

  const ready = state === 'ready' && !dirty && result;
  const todayOption = ready && result.options[0];
  const room = ready ? result.report.price_limit : null;
  const canRecord = ready && (offer.price || !result.options[2].missing);
  const save = () => {
    const id = onSave(activeId, offer, result.report.payday);
    setActiveId(id);
    setMessage('Disimpan untuk dicek ' + dateLabel(result.report.payday) + '.');
  };

  return (
    <section className="surface purchase" aria-labelledby="purchase-title">
      <div className="section-row purchase-head">
        <div className="title-with-icon"><ReceiptText size={22} /><h2 id="purchase-title">Cek pembelian</h2></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Tutup cek pembelian"><X size={21} /></button>
      </div>
      <form className="purchase-form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Barang yang ingin dibeli">
            <input required maxLength={100} value={offer.item} onChange={(e) => changed('item', e.target.value)} />
          </Field>
          <Field label="Harga tunai">
            <MoneyInput min={1} value={offer.price} onChange={(value) => changed('price', value)}
              placeholder="Jika diketahui" inputRef={priceRef} />
          </Field>
        </div>
        <div className="purchase-toggles">
          <label className="check"><input type="checkbox" checked={offer.urgent} onChange={(e) => changed('urgent', e.target.checked)} /> Butuh segera</label>
          <label className="check"><input type="checkbox" checked={offer.bucket === 'essential'}
            onChange={(e) => changed('bucket', e.target.checked ? 'essential' : 'flexible')} /> Pakai pos kebutuhan</label>
        </div>
        <div className="purchase-details">
          <button type="button" className="link-button" aria-expanded={showTerms} aria-controls="installment-fields"
            onClick={() => setShowTerms(!showTerms)}><CalendarClock size={18} /> {showTerms ? 'Sembunyikan opsi cicilan' : 'Isi opsi cicilan'}</button>
          {showTerms && (
            <div id="installment-fields" className="form-grid installment-fields">
              <Field label="Cicilan per bulan"><MoneyInput value={offer.installment?.payment} min={1} onChange={(v) => changeTerm('payment', v)} /></Field>
              <Field label="Jumlah bulan"><input type="number" step="1" min="1" max="60" value={offer.installment?.months ?? ''}
                onChange={(e) => changeTerm('months', numberField(e.target.value))} /></Field>
              <Field label="Tanggal cicilan pertama"><input type="date" min={budget.today} value={offer.installment?.first_due ?? ''}
                onChange={(e) => changeTerm('first_due', e.target.value || null)} /></Field>
              <Field label="Total biaya awal" hint="Uang muka dan biaya di luar cicilan. Isi 0 jika tidak ada.">
                <MoneyInput value={offer.installment?.upfront} onChange={(v) => changeTerm('upfront', v)} />
              </Field>
            </div>
          )}
        </div>
        <label className="check savings-toggle">
          <input type="checkbox" checked={offer.redirect_savings} onChange={(e) => changed('redirect_savings', e.target.checked)} />
          Simulasikan pengurangan setoran tabungan
        </label>
        <div className="purchase-submit">
          <button type="submit" className="button button-primary" disabled={state === 'loading'}>
            {state === 'loading' ? 'Menghitung…' : committed ? 'Perbarui perbandingan' : 'Bandingkan'} <ArrowRight size={17} />
          </button>
        </div>
      </form>
      {error && <Notice error>{error}</Notice>}
      {state === 'ready' && dirty && <Notice>Perbarui perbandingan untuk memakai perubahan terakhir.</Notice>}
      {ready && (
        <div className="receipt" aria-live="polite">
          <div className="receipt-result">
            <div>
              <p className="receipt-label">Batas harga tunai dari pos fleksibel</p>
              <p className="receipt-amount">{money(room)}</p>
              <p>Sampai {dateLabel(result.report.payday)}, dengan tagihan dan setoran terjadwal disisihkan.</p>
            </div>
            {todayOption.purchase_gap && (
              <div className="receipt-gap">
                <span>{money(todayOption.purchase_gap.short)}</span>
                <p>di atas anggaran jika dibeli hari ini</p>
              </div>
            )}
          </div>
          <h3 className="receipt-title">Pilihan pembayaran</h3>
          <div className="scenarios">
            {result.options.map((option) => <Scenario key={option.mode} option={option} installment={offer.installment}
              today={budget.today} payday={result.report.payday} />)}
          </div>
          <p className="projection-note">Perkiraan memakai pemasukan, tagihan, dan setoran yang tercatat. Pengeluaran berikutnya bisa mengubah hasil.</p>
          <div className="reflection">
            <CircleHelp size={20} />
            <div><p>{result.explanation.text}</p>
              <a href={result.explanation.source.url} target="_blank" rel="noreferrer">Sumber saran · {result.explanation.source.title}</a>
            </div>
          </div>
          <div className="receipt-actions">
            <button type="button" className="button button-primary" onClick={save}><Bookmark size={17} /> Simpan untuk dicek lagi</button>
            <button type="button" className="button button-outline" onClick={() => priceRef.current?.focus()}>Ubah harga</button>
            {canRecord && <button type="button" className="link-button" onClick={() => setRecording(true)}>Catat pembelian</button>}
          </div>
          {message && <Notice>{message}</Notice>}
          {recording && <RecordDialog offer={offer} comparison={result} onClose={() => setRecording(false)}
            onConfirm={(method) => { setRecording(false); onRecord(offer, method, activeId); }} />}
        </div>
      )}
    </section>
  );
}
