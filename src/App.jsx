import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft, ArrowRight, Bookmark, CalendarDays, ChartNoAxesColumn, ChevronDown,
  ChevronRight, Clock3, House, Pencil, ReceiptText, Settings2, Target, Trash2, Wallet,
} from 'lucide-react';
import { BudgetDialog, ExpenseDialog, GoalDialog } from './BudgetForms.jsx';
import Purchase, { offerFromPreview } from './Purchase.jsx';
import {
  api, dateLabel, dayLabel, Dialog, errorText, ExpenseFields, Meter, money, newId, Notice,
} from './shared.jsx';

const storageKey = 'antive-demo-v1';
const pages = [
  { id: 'hari-ini', label: 'Hari ini', icon: House },
  { id: 'riwayat', label: 'Riwayat', icon: ReceiptText },
  { id: 'tujuan', label: 'Tujuan', icon: Target },
];

function readStorage() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (Array.isArray(value?.profiles) && value.profiles.length === 2 &&
      value.profiles.every((profile) => profile.budget && Array.isArray(profile.saved))) return value;
  } catch {
    return null;
  }
  return null;
}

function currentPage() {
  const id = window.location.hash.slice(1);
  return pages.some((page) => page.id === id) ? id : 'hari-ini';
}

function Header({ profiles, activeId, onProfile, tab, disabled }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a href="#hari-ini" className="brand" aria-label="Antive, Hari ini">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          antive<span className="brand-period">.</span>
        </a>
        <nav aria-label="Menu utama" className="nav">
          {pages.map(({ id, label, icon: Icon }) => (
            <a key={id} href={'#' + id} aria-current={tab === id ? 'page' : undefined}>
              <Icon size={18} strokeWidth={1.8} /> <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="profile-picker">
          <span className="profile-icon" aria-hidden="true"><Wallet size={17} /></span>
          <label className="sr-only" htmlFor="profile-select">Profil contoh</label>
          <select id="profile-select" value={activeId} disabled={disabled} onChange={(e) => onProfile(e.target.value)}>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
          </select>
          <ChevronDown aria-hidden="true" size={15} />
        </div>
      </div>
    </header>
  );
}

function BalanceCard({ report, cadence, onBalance }) {
  const nextIncome = cadence === 'weekly' ? 'uang saku' : 'gajian';
  return (
    <section className="balance-card" aria-labelledby="balance-title">
      <div className="balance-top">
        <div>
          <p className="balance-label" id="balance-title"><Wallet size={17} /> Bisa dipakai sampai {nextIncome}</p>
          <p className="balance-amount">{money(report.price_limit)}</p>
          <p className="balance-date"><CalendarDays size={15} /> Pemasukan berikutnya {dayLabel(report.payday)}</p>
        </div>
        <button type="button" className="balance-edit" onClick={onBalance}><Pencil size={16} /> Ubah saldo</button>
      </div>
      <dl className="balance-breakdown">
        <div><dt>Saldo tersedia</dt><dd>{money(report.cash)}</dd></div>
        <div><dt>Tagihan</dt><dd>{money(report.bill_reserve)}</dd></div>
        <div><dt>Setoran tabungan</dt><dd>{money(report.saving_reserve)}</dd></div>
      </dl>
      <p className="balance-note">Saldo per {dateLabel(report.balance_updated)} · Sisa pos fleksibel {money(report.flexible_remaining)}</p>
    </section>
  );
}

function GoalCard({ goal, report, full, onEdit }) {
  const percent = Math.min(100, Math.floor(report.balance / report.target * 100));
  return (
    <section className={'surface goal-card' + (full ? ' goal-full' : '')} aria-labelledby="goal-card-title">
      <div className="section-row">
        <div className="title-with-icon">
          <span className="section-icon"><Target size={19} /></span>
          <h2 id="goal-card-title">{goal.label}</h2>
        </div>
        {full ? <button className="button button-outline" type="button" onClick={onEdit}><Pencil size={16} /> Ubah tujuan</button> :
          <a href="#tujuan" className="icon-button" aria-label="Lihat tujuan tabungan"><ChevronRight size={19} /></a>}
      </div>
      <div className="goal-progress">
        <div className="goal-values"><strong>{money(report.balance)}</strong><span>{percent}%</span></div>
        <Meter value={report.balance} total={report.target}
          label={money(report.balance) + ' terkumpul dari target ' + money(report.target) + ', ' + percent + ' persen'} />
        <div className="goal-labels"><span>Terkumpul</span><span>Target {money(report.target)}</span></div>
      </div>
      <p className="goal-date"><CalendarDays size={16} />
        {report.balance >= report.target ? 'Tujuan tercapai' : report.date
          ? 'Perkiraan tercapai ' + dateLabel(report.date) + ' ' + report.date.slice(0, 4)
          : 'Tanggal tercapai belum bisa diperkirakan'}
      </p>
      {full && <p className="muted">Setoran yang direncanakan {money(goal.contribution)} per periode. Perkiraan mengikuti jadwal pemasukan dan tagihan contoh.</p>}
    </section>
  );
}

function SavedChecks({ saved, today, onOpen, onDelete }) {
  return (
    <section className="surface saved-card" aria-labelledby="saved-title">
      <div className="title-with-icon">
        <span className="section-icon"><Bookmark size={19} /></span><h2 id="saved-title">Cek tersimpan</h2>
        {saved.length > 0 && <span className="saved-count">{saved.length}</span>}
      </div>
      {!saved.length ? (
        <div className="saved-empty">
          <p>Belum ada cek tersimpan</p>
          <span>Simpan rencana belanja untuk dihitung ulang setelah pemasukan berikutnya.</span>
        </div>
      ) : (
        <ul className="saved-list">
          {saved.map((item) => (
            <li key={item.id}>
              <button type="button" className="saved-open" onClick={() => onOpen(item)}>
                <span><strong>{item.offer.item}</strong>
                  <small>{item.revisit_on <= today ? 'Siap dicek lagi' : 'Cek lagi ' + dateLabel(item.revisit_on)}</small></span>
                <span className="saved-price">{item.offer.price ? money(item.offer.price) : 'Cicilan'} <ChevronRight size={16} /></span>
              </button>
              <button type="button" className="icon-button" aria-label={'Hapus cek ' + item.offer.item}
                onClick={() => onDelete(item.id)}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Expenses({ entries, onEdit, recent = false }) {
  const sorted = [...entries].sort((a, b) => b.on.localeCompare(a.on));
  const visible = recent ? sorted.slice(0, 3) : sorted;
  return (
    <ul className="entry-list">
      {visible.length === 0 && <li className="entry-empty">Belum ada pengeluaran tercatat.</li>}
      {visible.map((entry) => (
        <li key={entry.id}>
          <span className={'entry-icon' + (entry.kind === 'income' ? ' entry-income' : '')}>
            {entry.kind === 'income' ? <ArrowDownLeft size={19} /> : <ReceiptText size={18} />}
          </span>
          <div className="entry-info">
            <strong>{entry.label}</strong>
            <span>{dateLabel(entry.on)} · {entry.kind === 'income' ? 'Pemasukan' : entry.kind === 'bill' ? 'Tagihan'
              : entry.kind === 'saving' ? 'Tabungan' : entry.bucket === 'flexible' ? 'Fleksibel' : 'Kebutuhan'}</span>
          </div>
          <span className="entry-amount">{entry.kind === 'income' ? '+' : ''}{money(entry.amount)}</span>
          {entry.kind === 'expense' && <button className="icon-button" type="button"
            onClick={() => onEdit(entry)} aria-label={'Ubah ' + entry.label}><Pencil size={16} /></button>}
        </li>
      ))}
    </ul>
  );
}

function ExpensePreview({ draft, today, onRecord }) {
  const [expense, setExpense] = useState({
    label: draft.item, amount: draft.price, on: draft.on, bucket: draft.bucket, kind: 'expense',
  });
  return (
    <section className="surface expense-preview" aria-labelledby="expense-preview-title">
      <h2 id="expense-preview-title">Pratinjau pengeluaran</h2>
      <form onSubmit={(event) => { event.preventDefault(); onRecord(expense); }}>
        <ExpenseFields expense={expense} today={today}
          update={(key, value) => setExpense((current) => ({ ...current, [key]: value }))} />
        <button type="submit" className="button button-primary">Simpan pengeluaran</button>
      </form>
    </section>
  );
}

function Home({ profile, report, onBalance, onBudget, onEditExpense, onSave, onRemove, onEntry, onRecord, onBill }) {
  const { budget, saved } = profile;
  const [text, setText] = useState('');
  const [draft, setDraft] = useState(null);
  const [intent, setIntent] = useState(null);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const inputRef = useRef(null);
  const draftRef = useRef(null);
  const controllerRef = useRef(null);

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    if (draft) draftRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [draft]);

  const submit = async (event) => {
    event.preventDefault();
    if (pending || !text.trim()) return;
    setPending(true);
    setProblem('');
    setNotice('');
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const preview = await api('preview', { text, today: budget.today }, controller.signal);
      setDraft({ key: newId(), preview });
      setIntent(preview.intent);
    } catch (error) {
      if (error.name !== 'AbortError') setProblem(errorText(error));
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  };

  const loadSaved = (item) => {
    setProblem('');
    setNotice('');
    setDraft({ key: newId(), saved: item });
    setIntent('purchase');
  };

  return (
    <div className="home-grid">
      <div className="home-main">
        <BalanceCard report={report} cadence={budget.cadence} onBalance={onBalance} />
        <section className="surface composer" aria-labelledby="composer-title">
          <div className="title-with-icon">
            <span className="section-icon"><ReceiptText size={19} /></span><h2 id="composer-title">Catat atau cek</h2>
          </div>
          <form onSubmit={submit}>
            <label className="sr-only" htmlFor="spending-text">Pengeluaran atau rencana belanja</label>
            <div className="composer-input">
              <textarea id="spending-text" ref={inputRef} rows="2" value={text} required maxLength={500}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ceritakan pengeluaran atau barang yang ingin dibeli…" />
              <button type="submit" className="button button-primary" disabled={pending || !text.trim()}>
                {pending ? 'Memeriksa…' : 'Periksa'} <ArrowRight size={17} />
              </button>
            </div>
            <div className="examples">
              <span>Coba</span>
              {['Tadi makan 25rb', 'Mau beli HP bekas 1,5jt'].map((example) => (
                <button className="example" key={example} type="button" onClick={() => {
                  setText(example);
                  inputRef.current?.focus();
                }}>{example}</button>
              ))}
            </div>
          </form>
          {problem && <Notice error>{problem}</Notice>}
          {notice && <Notice>{notice}</Notice>}
        </section>
        {draft && <div className="draft" ref={draftRef}>
          {draft.preview && <div className="intent-switch" aria-label="Jenis catatan">
            <span>Jenis</span>
            <button type="button" aria-pressed={intent === 'expense'} onClick={() => setIntent('expense')}>Pengeluaran</button>
            <button type="button" aria-pressed={intent === 'purchase'} onClick={() => setIntent('purchase')}>Rencana beli</button>
          </div>}
          {intent === null && <Notice>Pilih apakah ini pengeluaran atau rencana pembelian.</Notice>}
          {intent === 'expense' && <ExpensePreview key={draft.key} draft={draft.preview} today={budget.today}
            onRecord={(expense) => {
              onEntry({ ...expense, label: expense.label.trim(), id: draft.key });
              setDraft(null);
              setText('');
              setNotice('Pengeluaran disimpan.');
            }} />}
          {intent === 'purchase' && <Purchase key={draft.key} budget={budget}
            initial={draft.saved?.offer ?? offerFromPreview(draft.preview)} savedId={draft.saved?.id}
            onSave={onSave} onClose={() => setDraft(null)}
            onRecord={(offer, method, savedId) => {
              onRecord(offer, method, savedId, draft.key);
              setDraft(null);
              setText('');
              setNotice('Pembelian dicatat.');
            }} />}
        </div>}
        <section className="surface recent" aria-labelledby="recent-title">
          <div className="section-row">
            <div className="title-with-icon">
              <span className="section-icon"><Clock3 size={19} /></span><h2 id="recent-title">Pengeluaran terakhir</h2>
            </div>
            <a href="#riwayat" className="link-button">Lihat riwayat <ChevronRight size={16} /></a>
          </div>
          <Expenses entries={budget.entries.filter((entry) => entry.kind === 'expense')} onEdit={onEditExpense} recent />
        </section>
      </div>
      <aside className="home-aside" aria-label="Tujuan, cek tersimpan, dan tagihan">
        <GoalCard goal={budget.goal} report={report.goal} />
        <SavedChecks saved={saved} today={budget.today} onOpen={loadSaved} onDelete={onRemove} />
        <section className="surface bills-card" aria-labelledby="bills-title">
          <div className="section-row">
            <div className="title-with-icon"><span className="section-icon"><CalendarDays size={18} /></span><h2 id="bills-title">Tagihan berikutnya</h2></div>
            <button type="button" className="icon-button" aria-label="Atur anggaran" onClick={onBudget}><Settings2 size={18} /></button>
          </div>
          {report.bills.length === 0 ? <p className="muted">Tidak ada tagihan sebelum pemasukan berikutnya.</p> :
            <ul className="bill-list">{report.bills.map((bill) => (
              <li key={bill.id}>
                <div className="section-row"><strong>{bill.label}</strong><strong>{money(bill.amount)}</strong></div>
                <div className="section-row">
                  <small>Jatuh tempo {dateLabel(bill.on)}</small>
                  <button type="button" className="link-button bill-pay" onClick={() => onBill(bill)}>Catat dibayar</button>
                </div>
              </li>
            ))}</ul>}
        </section>
      </aside>
    </div>
  );
}

function History({ budget, report, onEditExpense }) {
  return (
    <div className="secondary-grid">
      <section className="surface history-list" aria-labelledby="history-title">
        <div className="title-with-icon">
          <span className="section-icon"><ReceiptText size={19} /></span><h2 id="history-title">Semua catatan</h2>
        </div>
        <Expenses entries={budget.entries} onEdit={onEditExpense} />
      </section>
      <section className="surface cycle" aria-labelledby="cycle-title">
        <div className="title-with-icon">
          <span className="section-icon"><ChartNoAxesColumn size={19} /></span><h2 id="cycle-title">Belanja fleksibel</h2>
        </div>
        <p className="muted">{dateLabel(report.cycle_start)} sampai {dateLabel(report.payday)} · sebelum pemasukan berikutnya</p>
        <div className="cycle-value">{money(report.flexible_spent)}</div>
        <Meter tone={report.flexible_spent > report.flexible_limit ? 'amber' : 'green'} value={report.flexible_spent}
          total={report.flexible_limit} label={money(report.flexible_spent) + ' terpakai, sisa ' + money(report.flexible_remaining)} />
        <div className="goal-labels"><span>Terpakai</span><span>Sisa {money(report.flexible_remaining)}</span></div>
        <p className="muted">Batas periode {money(report.flexible_limit)}</p>
        {report.flexible_spent > report.flexible_limit && (
          <Notice>Belanja melampaui batas sebesar {money(report.flexible_spent - report.flexible_limit)}.</Notice>
        )}
      </section>
    </div>
  );
}

export default function App() {
  const [initial] = useState(readStorage);
  const [profiles, setProfiles] = useState(initial?.profiles ?? []);
  const [activeId, setActiveId] = useState(initial?.activeId ?? 'worker');
  const [tab, setTab] = useState(currentPage);
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [reportState, setReportState] = useState(null);
  const [fetchCount, setFetchCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notification, setNotification] = useState('');
  const current = profiles.find((profile) => profile.id === activeId) ?? profiles[0];
  const budget = current?.budget;
  const report = reportState?.data;
  const currentBudgetRef = useRef(null);
  currentBudgetRef.current = budget;

  useEffect(() => {
    const listener = () => {
      setTab(currentPage());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);

  useEffect(() => {
    if (profiles.length) return undefined;
    const controller = new AbortController();
    setError('');
    api('demo', undefined, controller.signal).then(setProfiles).catch((problem) => {
      if (problem.name !== 'AbortError') setError(errorText(problem));
    });
    return () => controller.abort();
  }, [profiles.length, fetchCount]);

  useEffect(() => {
    if (!profiles.length) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ profiles, activeId }));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [profiles, activeId]);

  useEffect(() => {
    if (!budget) return undefined;
    const controller = new AbortController();
    setError('');
    api('report', budget, controller.signal).then((data) => setReportState({ data, budget, id: current.id }))
      .catch((problem) => {
        if (problem.name !== 'AbortError') setError(errorText(problem));
      });
    return () => controller.abort();
  }, [budget, current?.id, fetchCount]);

  function updateProfile(update, id = current.id) {
    setProfiles((values) => values.map((profile) => profile.id === id ? update(profile) : profile));
  }

  function updateBudget(next) {
    updateProfile((profile) => ({ ...profile, budget: next }));
    setDialog(null);
  }

  function addEntry(entry) {
    if (!entry.label.trim()) {
      setNotification('Isi nama pengeluaran.');
      return;
    }
    updateProfile((profile) => ({
      ...profile,
      budget: {
        ...profile.budget,
        entries: profile.budget.entries.some((item) => item.id === entry.id)
          ? profile.budget.entries : [...profile.budget.entries, entry],
      },
    }));
  }

  function saveCheck(id, offer, revisit_on) {
    const check = { id: id ?? newId(), offer, revisit_on };
    updateProfile((profile) => ({
      ...profile, saved: [check, ...profile.saved.filter((item) => item.id !== check.id)],
    }));
    return check.id;
  }

  function recordPurchase(offer, method, savedId, id) {
    updateProfile((profile) => {
      const { budget: previous } = profile;
      if (previous.entries.some((entry) => entry.id === id) || previous.bills.some((bill) => bill.id === id)) return profile;
      const financed = method === 'installment';
      const amount = financed ? offer.installment.upfront : offer.price;
      const entries = amount ? [...previous.entries, {
        id, label: offer.item, amount, on: previous.today, bucket: offer.bucket, kind: 'expense',
      }] : previous.entries;
      const bills = financed ? [...previous.bills, {
        id, label: ('Cicilan ' + offer.item).slice(0, 100), amount: offer.installment.payment,
        first_due: offer.installment.first_due, repeat: 'monthly', count: offer.installment.months,
      }] : previous.bills;
      return {
        ...profile, budget: { ...previous, entries, bills },
        saved: profile.saved.filter((item) => item.id !== savedId),
      };
    });
  }

  async function simulatePayday() {
    if (busy) return;
    setBusy(true);
    setNotification('');
    try {
      const next = await api('advance', budget);
      if (currentBudgetRef.current !== budget) {
        setNotification('Anggaran berubah. Coba simulasikan lagi.');
        return;
      }
      updateProfile((profile) => ({ ...profile, budget: next }));
      setNotification('Tanggal simulasi maju ke ' + dateLabel(next.today) + '.');
    } catch (problem) {
      setNotification(errorText(problem));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      const samples = await api('demo');
      const sample = samples.find((profile) => profile.id === current.id);
      updateProfile(() => sample);
      setDialog(null);
      setNotification('Profil contoh direset.');
    } catch (problem) {
      setNotification(errorText(problem));
    } finally {
      setBusy(false);
    }
  }

  function editExpense(entry) {
    const label = entry.label.trim();
    if (!label) return;
    updateBudget({ ...budget, entries: budget.entries.map((item) => item.id === entry.id ? { ...entry, label } : item) });
  }

  const showReport = report && reportState.id === current?.id;
  const upToDate = showReport && reportState.budget === budget;
  const pageTitle = pages.find((page) => page.id === tab).label;

  return (
    <>
      <a href="#main-content" className="skip-link" onClick={(event) => {
        event.preventDefault();
        document.getElementById('main-content')?.focus();
      }}>Ke konten utama</a>
      <Header profiles={profiles} activeId={activeId} disabled={busy || !profiles.length} tab={tab} onProfile={(id) => {
        setActiveId(id);
        setDialog(null);
        setNotification('');
      }} />
      <main id="main-content" tabIndex="-1" className="main">
        <div className="page-head">
          <div>
            <div className="date-line"><CalendarDays size={16} /> {budget ? dayLabel(budget.today) + ' ' + budget.today.slice(0, 4) : 'Data contoh'}</div>
            <h1>{pageTitle}</h1>
          </div>
          {budget && <div className="page-actions">
            <button type="button" className="button button-outline" disabled={busy || !upToDate} onClick={simulatePayday}>
              <Clock3 size={16} /> {busy ? 'Memproses…' : budget.cadence === 'weekly' ? 'Simulasikan uang saku' : 'Simulasikan gajian'}
            </button>
          </div>}
        </div>
        {storageError && <Notice error>Penyimpanan browser tidak tersedia. Perubahan hanya bertahan di halaman ini.</Notice>}
        {notification && <Notice>{notification}</Notice>}
        {error && <div className="error-banner"><Notice error>{error}</Notice>
          <button className="button button-outline" type="button" onClick={() => setFetchCount((count) => count + 1)}>Coba lagi</button></div>}
        {!showReport && !error && <div className="surface loading" role="status">Memuat anggaran contoh…</div>}
        {showReport && tab === 'hari-ini' && <Home key={current.id} profile={current} report={report}
          onBalance={() => setDialog({ type: 'balance' })} onBudget={() => setDialog({ type: 'budget' })}
          onEditExpense={(entry) => setDialog({ type: 'expense', entry })}
          onEntry={addEntry} onSave={saveCheck} onRemove={(id) => updateProfile((profile) => ({
            ...profile, saved: profile.saved.filter((item) => item.id !== id),
          }))} onRecord={recordPurchase}
          onBill={(bill) => addEntry({
            id: bill.id, event_id: bill.id, kind: 'bill', label: bill.label, amount: bill.amount,
            on: budget.today, bucket: 'essential',
          })} />}
        {showReport && tab === 'riwayat' && <History budget={budget} report={report}
          onEditExpense={(entry) => setDialog({ type: 'expense', entry })} />}
        {showReport && tab === 'tujuan' && <GoalCard key={current.id} goal={budget.goal} report={report.goal} full
          onEdit={() => setDialog({ type: 'goal' })} />}
      </main>
      <footer className="footer">
        <span>Data contoh · Perubahan disimpan di browser ini</span>
        {budget && <button type="button" className="link-button" onClick={() => setDialog({ type: 'reset' })}>Reset profil contoh</button>}
      </footer>
      {dialog && showReport && ['balance', 'budget'].includes(dialog.type) &&
        <BudgetDialog budget={budget} report={report} balanceOnly={dialog.type === 'balance'}
          onSave={updateBudget} onClose={() => setDialog(null)} />}
      {dialog?.type === 'goal' && <GoalDialog goal={budget.goal} onClose={() => setDialog(null)}
        onSave={(goal) => updateBudget({ ...budget, goal })} />}
      {dialog?.type === 'expense' && <ExpenseDialog entry={dialog.entry} today={budget.today}
        onClose={() => setDialog(null)} onSave={editExpense}
        onDelete={(id) => updateBudget({ ...budget, entries: budget.entries.filter((entry) => entry.id !== id) })} />}
      {dialog?.type === 'reset' && <ResetDialog busy={busy} onReset={reset} onClose={() => setDialog(null)} />}
    </>
  );
}

function ResetDialog({ busy, onReset, onClose }) {
  return (
    <Dialog title="Reset profil contoh?" onClose={onClose}>
      <div className="dialog-form">
        <p>Anggaran, catatan, dan cek tersimpan pada profil ini akan kembali ke contoh awal.</p>
        <div className="dialog-actions">
          <button className="button button-outline" type="button" onClick={onClose}>Batal</button>
          <button className="button button-danger" type="button" onClick={onReset} disabled={busy}>
            {busy ? 'Mereset…' : 'Reset profil'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
