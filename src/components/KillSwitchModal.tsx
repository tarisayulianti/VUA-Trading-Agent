import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, X, CheckCircle2 } from 'lucide-react';

interface KillSwitchModalProps {
  isOpen: boolean;
  isKillSwitchEngaged: boolean;
  openPositionsCount: number;
  onClose: () => void;
  onConfirm: (action: 'ENGAGE' | 'DISENGAGE', closePositions: boolean) => Promise<void>;
}

export const KillSwitchModal: React.FC<KillSwitchModalProps> = ({
  isOpen,
  isKillSwitchEngaged,
  openPositionsCount,
  onClose,
  onConfirm,
}) => {
  const [closePositions, setClosePositions] = useState(true);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAction = async () => {
    setLoading(true);
    try {
      await onConfirm(isKillSwitchEngaged ? 'DISENGAGE' : 'ENGAGE', closePositions);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="vua-killswitch-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className={`p-4 flex items-center justify-between border-b ${
          isKillSwitchEngaged ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center space-x-2.5">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="text-sm font-bold font-mono uppercase tracking-wider">
              {isKillSwitchEngaged ? 'Disengage Emergency Safety Lock' : 'Emergency System Kill Switch'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-600">
          {!isKillSwitchEngaged ? (
            <>
              <div className="flex items-start space-x-3 bg-rose-50 border border-rose-200 rounded-lg p-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-rose-900">Absolute Circuit Breaker Directive</p>
                  <p className="text-rose-700 leading-relaxed">
                    Engaging the Kill Switch instantly halts all autonomous perception loops, cancels all pending order dispatch, and freezes risk limits.
                  </p>
                </div>
              </div>

              {openPositionsCount > 0 && (
                <label className="flex items-center space-x-3 bg-slate-50 p-3 rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={closePositions}
                    onChange={(e) => setClosePositions(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 bg-white border-slate-300"
                  />
                  <div>
                    <span className="font-semibold text-slate-900">Emergency Flatten Open Positions</span>
                    <p className="text-[11px] text-slate-500">
                      Market-close all {openPositionsCount} active position{openPositionsCount > 1 ? 's' : ''} immediately to eliminate market exposure.
                    </p>
                  </div>
                </label>
              )}

              <p className="text-[11px] text-slate-500 font-mono">
                Core Principle: Capital preservation &gt; opportunity.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-start space-x-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-900">Restore Safe Engine Operation</p>
                  <p className="text-emerald-800 leading-relaxed">
                    Disengaging the Kill Switch restores the engine to normal deterministic risk validation. The system will resume monitoring markets without automatic execution until explicitly triggered or enabled.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-3.5 py-1.5 rounded text-xs font-mono text-slate-700 hover:text-slate-900 bg-white border border-slate-200 cursor-pointer shadow-2xs font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleAction}
            disabled={loading}
            className={`px-4 py-1.5 rounded text-xs font-mono font-bold uppercase transition cursor-pointer shadow-xs ${
              isKillSwitchEngaged
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            {loading
              ? 'Processing...'
              : isKillSwitchEngaged
              ? 'Confirm Disengage'
              : 'CONFIRM KILL SWITCH'}
          </button>
        </div>
      </div>
    </div>
  );
};
