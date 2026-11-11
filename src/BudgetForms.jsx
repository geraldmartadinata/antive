import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, ExpenseFields, Field, MoneyInput, newId } from './shared.jsx';

export function BudgetDialog({ budget, report, balanceOnly, onSave, onClose }) {
  const [edit, setEdit] = useState({
    cash: Math.max(0, report.cash),
    income: budget.income,
    payday: report.payday,
    flexible_limit: budget.flexible_limit,
    cadence: budget.cadence,
    bills: budget.bills,
  });
  const update = (key, value) => setEdit((current) => ({ ...current, [key]: value }));
  const changeBill = (id, key, value) => setEdit((current) => ({
    ...current,
    bills: current.bills.map((bill) => bill.id === id ? { ...bill, [key]: value } : bill),
  }));
  const save = (event) => {
    event.preventDefault();
    const cashChanged = edit.cash !== report.cash;
    const balance = cashChanged ? {
      amount: edit.cash,
      on: budget.today,
      included_today: budget.entries.filter((entry) => entry.on === budget.today).map((entry) => entry.id),
    } : budget.balance;
    if (balanceOnly) {
      onSave({ ...budget, balance });
      return;
    }
    const payday = edit.payday === report.payday && edit.cadence === budget.cadence
      ? budget.payday : edit.payday;
    onSave({
      ...budget, balance, payday, income: edit.income, cadence: edit.cadence,
      flexible_limit: edit.flexible_limit, bills: edit.bills,
    });
  };
  return (
    <Dialog title={balanceOnly ? 'Ubah saldo' : 'Atur anggaran contoh'} onClose={onClose}>
      <form onSubmit={save} className="dialog-form">
        <Field label="Saldo yang bisa digunakan" hint="Keluarkan dana yang sudah masuk tabungan dari angka ini.">
          <MoneyInput value={edit.cash} onChange={(value) => update('cash', value)} required />
        </Field>
        {!balanceOnly && <>
          <div className="form-grid">
            <Field label="Jadwal pemasukan">
              <select value={edit.cadence} onChange={(e) => update('cadence', e.target.value)}>
                <option value="monthly">Bulanan</option><option value="weekly">Mingguan</option>
              </select>
            </Field>
            <Field label="Pemasukan per periode">
              <MoneyInput value={edit.income} onChange={(value) => update('income', value)} required />
            </Field>
            <Field label="Pemasukan berikutnya">
              <input type="date" required value={edit.payday} onChange={(e) => update('payday', e.target.value)} />
            </Field>
            <Field label="Batas belanja fleksibel">
              <MoneyInput value={edit.flexible_limit} onChange={(value) => update('flexible_limit', value)} required />
            </Field>
          </div>
          <section className="bills-form" aria-labelledby="bills-form-title">
            <div className="section-row">
              <h3 id="bills-form-title">Tagihan terjadwal</h3>
              <button type="button" className="link-button" onClick={() => update('bills', [...edit.bills, {
                id: newId(), label: '', amount: null, first_due: budget.today, repeat: 'once', count: null,
              }])}><Plus size={17} /> Tambah</button>
            </div>
            {edit.bills.map((bill) => (
              <fieldset key={bill.id} className="bill-form">
                <div className="section-row">
                  <span>{bill.label || 'Tagihan baru'}</span>
                  <button type="button" className="icon-button" aria-label={'Hapus ' + (bill.label || 'tagihan baru')}
                    onClick={() => update('bills', edit.bills.filter((item) => item.id !== bill.id))}><Trash2 size={17} /></button>
                </div>
                <div className="form-grid">
                  <Field label="Nama"><input value={bill.label} required pattern={'.*\\S.*'} maxLength={100} onChange={(e) => changeBill(bill.id, 'label', e.target.value)} /></Field>
                  <Field label="Jumlah"><MoneyInput value={bill.amount} required min={1} onChange={(v) => changeBill(bill.id, 'amount', v)} /></Field>
                  <Field label="Tanggal tagihan pertama"><input type="date" required value={bill.first_due} onChange={(e) => changeBill(bill.id, 'first_due', e.target.value)} /></Field>
                  <Field label="Pengulangan">
                    <select value={bill.repeat} onChange={(e) => changeBill(bill.id, 'repeat', e.target.value)}>
                      <option value="once">Sekali</option><option value="monthly">Bulanan</option><option value="weekly">Mingguan</option>
                    </select>
                  </Field>
                </div>
              </fieldset>
            ))}
          </section>
        </>}
        <div className="dialog-actions"><button className="button button-primary" type="submit">Simpan perubahan</button></div>
      </form>
    </Dialog>
  );
}

export function GoalDialog({ goal, onSave, onClose }) {
  const [edit, setEdit] = useState(goal);
  const update = (key, value) => setEdit((current) => ({ ...current, [key]: value }));
  return (
    <Dialog title="Ubah tujuan tabungan" onClose={onClose}>
      <form className="dialog-form" onSubmit={(event) => { event.preventDefault(); onSave(edit); }}>
        <Field label="Nama tujuan"><input required pattern={'.*\\S.*'} maxLength={100} value={edit.label} onChange={(e) => update('label', e.target.value)} /></Field>
        <div className="form-grid">
          <Field label="Target"><MoneyInput value={edit.target} min={1} required onChange={(value) => update('target', value)} /></Field>
          <Field label="Saldo awal tujuan"><MoneyInput value={edit.balance} required onChange={(value) => update('balance', value)} /></Field>
          <Field label="Setoran per periode"><MoneyInput value={edit.contribution} required onChange={(value) => update('contribution', value)} /></Field>
          <Field label="Tanggal setoran pertama"><input type="date" required value={edit.first_due} onChange={(e) => update('first_due', e.target.value)} /></Field>
        </div>
        <div className="dialog-actions"><button type="submit" className="button button-primary">Simpan tujuan</button></div>
      </form>
    </Dialog>
  );
}

export function ExpenseDialog({ entry, today, onSave, onDelete, onClose }) {
  const [expense, setExpense] = useState(entry);
  const [deleting, setDeleting] = useState(false);
  return (
    <Dialog title={deleting ? 'Hapus pengeluaran?' : 'Ubah pengeluaran'} onClose={onClose}>
      {deleting ? (
        <div className="dialog-form">
          <p>{entry.label} akan dihapus dari riwayat. Anggaran akan dihitung ulang.</p>
          <div className="dialog-actions">
            <button className="button button-outline" onClick={() => setDeleting(false)}>Kembali</button>
            <button className="button button-danger" onClick={() => onDelete(entry.id)}>Hapus pengeluaran</button>
          </div>
        </div>
      ) : (
        <form className="dialog-form" onSubmit={(event) => { event.preventDefault(); onSave(expense); }}>
          <ExpenseFields expense={expense} today={today}
            update={(key, value) => setExpense((current) => ({ ...current, [key]: value }))} />
          <div className="dialog-actions">
            <button type="button" className="link-button danger-text" onClick={() => setDeleting(true)}>Hapus</button>
            <button type="submit" className="button button-primary">Simpan pengeluaran</button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
