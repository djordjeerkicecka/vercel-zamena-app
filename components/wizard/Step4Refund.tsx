"use client";

import { useState } from "react";
import {
  isValidSerbianBankAccount,
  formatSerbianBankAccountAsTyped,
  bankAccountDigitCount,
  BANK_ACCOUNT_DIGITS,
} from "@/lib/bankAccount";
import { REFUND_WINDOW_DAYS } from "@/lib/constants";

interface Props {
  bankAccount: string;
  bankAccountOwner: string;
  goodsReceivedDate: string;
  refundTermsConfirmed: boolean;
  onBankAccountChange: (v: string) => void;
  onBankAccountOwnerChange: (v: string) => void;
  onGoodsReceivedDateChange: (v: string) => void;
  onRefundTermsConfirmedChange: (v: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step4Refund({
  bankAccount,
  bankAccountOwner,
  goodsReceivedDate,
  refundTermsConfirmed,
  onBankAccountChange,
  onBankAccountOwnerChange,
  onGoodsReceivedDateChange,
  onRefundTermsConfirmedChange,
  onNext,
  onBack,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  function handleNext() {
    if (!isValidSerbianBankAccount(bankAccount)) {
      setError(`Broj tekućeg računa mora imati tačno ${BANK_ACCOUNT_DIGITS} cifara.`);
      return;
    }
    if (!bankAccountOwner.trim()) {
      setError("Unesite ime i prezime vlasnika računa.");
      return;
    }
    if (!goodsReceivedDate) {
      setError("Unesite datum prijema robe.");
      return;
    }
    if (!refundTermsConfirmed) {
      setError("Potrebno je potvrditi uslove refundacije.");
      return;
    }
    setError(null);
    onNext();
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-gray-900">Podaci za refundaciju</h2>

      <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
        <p className="font-semibold">Uslovi refundacije:</p>
        <p className="mt-1">
          zahtev mora biti podnet u roku od {REFUND_WINDOW_DAYS} dana od dana prijema robe, a roba ne
          sme biti nošena i mora biti u originalnom stanju.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="form-label" htmlFor="bankAccount">
            Broj tekućeg računa
          </label>
          <input
            id="bankAccount"
            type="text"
            inputMode="numeric"
            placeholder="XXX-XXXXXXXXXXXXX-XX"
            className="form-input"
            value={bankAccount}
            onChange={(e) => onBankAccountChange(formatSerbianBankAccountAsTyped(e.target.value))}
          />
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Unesite svih {BANK_ACCOUNT_DIGITS} cifara sa vašeg računa — crtice se dodaju
              automatski.
            </p>
            <span
              className={`text-xs font-medium ${
                bankAccountDigitCount(bankAccount) === BANK_ACCOUNT_DIGITS
                  ? "text-green-600"
                  : "text-gray-400"
              }`}
            >
              {bankAccountDigitCount(bankAccount)}/{BANK_ACCOUNT_DIGITS}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-amber-700">
            Pažljivo proverite broj tekućeg računa. Pogrešno unet račun značajno usporava isplatu
            refundacije.
          </p>
        </div>

        <div>
          <label className="form-label" htmlFor="bankAccountOwner">
            Ime i prezime vlasnika računa
          </label>
          <input
            id="bankAccountOwner"
            type="text"
            className="form-input"
            value={bankAccountOwner}
            onChange={(e) => onBankAccountOwnerChange(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label" htmlFor="goodsReceivedDate">
            Datum prijema robe
          </label>
          <input
            id="goodsReceivedDate"
            type="date"
            className="form-input"
            value={goodsReceivedDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onGoodsReceivedDateChange(e.target.value)}
          />
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-brand-500"
            checked={refundTermsConfirmed}
            onChange={(e) => onRefundTermsConfirmedChange(e.target.checked)}
          />
          <span className="text-sm text-gray-700">
            Potvrđujem da roba nije nošena i da je zahtev podnet u roku od 14 dana od prijema
          </span>
        </label>

        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="mt-8 flex gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={onBack}>
          Nazad
        </button>
        <button type="button" className="btn-primary flex-1" onClick={handleNext}>
          Dalje
        </button>
      </div>
    </div>
  );
}
