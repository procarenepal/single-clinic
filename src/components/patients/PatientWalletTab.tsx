import { useState, useEffect } from "react";
import { IoWalletOutline, IoAddOutline, IoTimeOutline, IoArrowForwardOutline } from "react-icons/io5";
import { Link } from "react-router-dom";
import { Patient, WalletTransaction, PatientPackage } from "@/types/models";
import { walletService } from "@/services/walletService";
import { patientPackageService } from "@/services/patientPackageService";
import { useAuthContext } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { addToast } from "@/components/ui/toast";

export default function PatientWalletTab({ patient }: { patient: Patient }) {
  const { clinicId, branchId, currentUser } = useAuthContext();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(patient.walletBalance || 0);

  const [activePackages, setActivePackages] = useState<PatientPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);

  useEffect(() => {
    loadTransactions();
    loadPackages();
  }, [patient.id, clinicId]);

  const loadPackages = async () => {
    if (!clinicId) return;
    try {
      setLoadingPackages(true);
      const data = await patientPackageService.getPatientPackages(patient.id, clinicId);
      setActivePackages(data.filter(p => p.status !== "expired"));
    } catch (error) {
      console.error("Error loading patient packages:", error);
    } finally {
      setLoadingPackages(false);
    }
  };

  const loadTransactions = async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      const data = await walletService.getPatientTransactions(patient.id, clinicId);
      setTransactions(data);
    } catch (error) {
      console.error("Error loading wallet transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId || !currentUser) return;
    
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      addToast({ title: "Invalid amount", description: "Please enter a valid amount", color: "warning" });
      return;
    }

    try {
      setSubmitting(true);
      await walletService.addFunds(
        patient.id,
        clinicId,
        branchId || "",
        depositAmount,
        paymentMethod,
        notes,
        currentUser.uid
      );
      
      addToast({ title: "Funds Added", description: `Successfully added NPR ${depositAmount} to wallet.`, color: "success" });
      setAmount("");
      setNotes("");
      setShowAddModal(false);
      setCurrentBalance(prev => prev + depositAmount);
      loadTransactions();
    } catch (error) {
      addToast({ title: "Error", description: "Failed to add funds", color: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header & Balance Card */}
      <div className="bg-surface border border-border-base rounded-[10px] p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <IoWalletOutline className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-[13px] text-text-muted font-medium uppercase tracking-wide">Available Balance</h3>
            <p className="text-[28px] font-bold text-text-main leading-tight">NPR {currentBalance.toLocaleString()}</p>
          </div>
        </div>
        <Button 
          color="primary" 
          startContent={<IoAddOutline className="w-4 h-4"/>}
          onClick={() => setShowAddModal(true)}
        >
          Add Funds
        </Button>
      </div>

      {/* Active Packages (Visual Session Tracking) */}
      {!loadingPackages && activePackages.length > 0 && (
        <div className="bg-surface border border-border-base rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-border-base bg-surface-2 flex items-center gap-2">
            <h3 className="text-[14px] font-semibold text-text-main">Active Packages & Sessions</h3>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {activePackages.map(pkg => (
              <div key={pkg.id} className="border border-border-base rounded-lg p-4 bg-surface-2/30 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-[14px] font-bold text-text-main">{pkg.packageName}</h4>
                    <p className="text-[12px] text-text-muted mt-0.5">Purchased: {pkg.createdAt.toLocaleDateString()}</p>
                    {pkg.expiresAt && (
                      <p className={`text-[11px] font-medium mt-1 ${
                        pkg.expiresAt < new Date() ? "text-red-500" : 
                        pkg.expiresAt < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? "text-orange-500" : "text-text-muted"
                      }`}>
                        {pkg.expiresAt < new Date() ? "Expired on: " : "Expires: "} {pkg.expiresAt.toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded border ${
                    pkg.status === "completed" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : 
                    pkg.status === "expired" ? "bg-red-50 text-red-600 border-red-200" : 
                    "bg-primary/10 text-primary border-primary/20"
                  }`}>
                    {pkg.status}
                  </span>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[12px] font-medium text-text-main">Sessions Progress</span>
                    <span className="text-[12px] font-bold text-primary">{pkg.usedSessions} / {pkg.totalSessions} Used</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pkg.sessions && pkg.sessions.length > 0 ? (
                      pkg.sessions.map((session, i) => (
                        <div 
                          key={i} 
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                            session.status === "completed"
                              ? "bg-primary border-primary text-white" 
                              : session.status === "in-progress"
                              ? "bg-orange-100 border-orange-400 text-orange-600 animate-pulse"
                              : "bg-surface border-border-base text-text-muted"
                          }`}
                          title={`Ticket ${i+1}: ${session.status.toUpperCase()}`}
                        >
                          {i + 1}
                        </div>
                      ))
                    ) : (
                      // Fallback for legacy packages without explicit tickets
                      Array.from({ length: pkg.totalSessions }).map((_, i) => (
                        <div 
                          key={i} 
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                            i < pkg.usedSessions 
                              ? "bg-primary border-primary text-white" 
                              : "bg-surface border-border-base text-text-muted"
                          }`}
                          title={i < pkg.usedSessions ? `Session ${i+1} Used` : `Session ${i+1} Available`}
                        >
                          {i + 1}
                        </div>
                      ))
                    )}
                  </div>
                  {pkg.sessions && pkg.sessions.length > 0 ? (
                    <div className="mt-4 pt-3 border-t border-border-base/50">
                      <span className="text-[11.5px] font-semibold text-text-muted mb-2 block tracking-wide uppercase">Session Checklist</span>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                        {pkg.sessions.map((session, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px] bg-surface/80 rounded px-2.5 py-1.5 border border-border-base/30">
                            <div className="flex items-center gap-2">
                              <span className="text-text-main font-semibold">Ticket #{session.sessionNumber}</span>
                              <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded border ${
                                session.status === "completed" ? "bg-primary/10 text-primary border-primary/20" :
                                session.status === "in-progress" ? "bg-orange-50 text-orange-600 border-orange-200" :
                                "bg-surface text-text-muted border-border-base"
                              }`}>
                                {session.status}
                              </span>
                            </div>
                            {session.status === "completed" && session.consumedAt && (
                              <span className="text-text-muted flex items-center gap-1.5">
                                <IoTimeOutline className="w-3 h-3"/> 
                                {new Date(session.consumedAt).toLocaleDateString()} 
                                {session.clinicianName && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-border-base mx-0.5"></span>
                                    {session.clinicianName}
                                  </>
                                )}
                              </span>
                            )}
                            {session.status === "in-progress" && (
                              <span className="text-orange-500 flex items-center gap-1.5 italic">
                                Currently with Doctor/Expert
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : pkg.sessionHistory && pkg.sessionHistory.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border-base/50">
                      <span className="text-[11.5px] font-semibold text-text-muted mb-2 block tracking-wide uppercase">Usage History</span>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                        {pkg.sessionHistory.map((history, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px] bg-surface/80 rounded px-2.5 py-1.5 border border-border-base/30">
                            <span className="text-text-main font-semibold">Session {idx + 1}</span>
                            <span className="text-text-muted flex items-center gap-1.5">
                              <IoTimeOutline className="w-3 h-3"/> 
                              {history.consumedAt.toLocaleDateString()} 
                              <span className="w-1 h-1 rounded-full bg-border-base mx-0.5"></span>
                              {history.clinicianName || "Unknown"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className="bg-surface border border-border-base rounded-[10px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border-base bg-surface-2 flex items-center gap-2">
          <IoTimeOutline className="w-4 h-4 text-primary" />
          <h3 className="text-[14px] font-semibold text-text-main">Transaction History</h3>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-8 text-center text-text-muted text-[13px]">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-[13px]">No wallet transactions found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-surface-2/50 border-b border-border-base text-[11px] uppercase tracking-wider text-text-muted">
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Amount</th>
                    <th className="px-5 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id} className="border-b border-border-base last:border-0 hover:bg-surface-2/30 transition-colors">
                      <td className="px-5 py-3 text-[13px] text-text-main">{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                          t.type === 'deposit' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
                        }`}>
                          {t.type}
                        </span>
                      </td>
                      <td className={`px-5 py-3 text-[13.5px] font-semibold ${t.type === 'deposit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.type === 'deposit' ? '+' : '-'} NPR {t.amount.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-[12px] text-text-muted">
                        {t.type === 'deposit' ? (
                          <>Paid via <span className="capitalize">{t.paymentMethod}</span></>
                        ) : (
                          <div className="flex items-center gap-1 flex-wrap">
                            Used on Invoice
                            {t.referenceId ? (
                              <Link 
                                to={`/dashboard/appointments-billing/${t.referenceId}`}
                                className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                                title={t.referenceId}
                              >
                                {t.referenceId.substring(0, 8)}...
                                <IoArrowForwardOutline className="w-3 h-3" />
                              </Link>
                            ) : (
                              'Unknown'
                            )}
                          </div>
                        )}
                        {t.notes && <div className="mt-0.5 text-[11px] italic">"{t.notes}"</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Funds Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-surface border border-border-base rounded shadow-2xl max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border-base bg-surface-2 flex justify-between items-center">
              <h3 className="text-[14px] font-semibold text-text-main">Add Funds to Wallet</h3>
            </div>
            <form onSubmit={handleAddFunds} className="p-4 space-y-4">
              <div>
                <label className="text-[12px] font-medium text-text-muted mb-1 block">Amount (NPR)</label>
                <input 
                  type="number" 
                  min="1" 
                  required 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] border border-border-base rounded focus:outline-none focus:border-primary"
                  placeholder="e.g. 50000"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-text-muted mb-1 block">Payment Method</label>
                <select 
                  value={paymentMethod} 
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] border border-border-base rounded focus:outline-none focus:border-primary bg-white"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="esewa">eSewa</option>
                  <option value="khalti">Khalti</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium text-text-muted mb-1 block">Notes (Optional)</label>
                <input 
                  type="text" 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] border border-border-base rounded focus:outline-none focus:border-primary"
                  placeholder="e.g. Deposit for laser package"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button color="default" variant="bordered" onClick={() => setShowAddModal(false)} disabled={submitting}>Cancel</Button>
                <Button color="primary" type="submit" isLoading={submitting}>Add Funds</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
