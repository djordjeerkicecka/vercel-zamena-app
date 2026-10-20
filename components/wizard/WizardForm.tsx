"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProgressBar } from "./ProgressBar";
import { Step1Type } from "./Step1Type";
import { Step2Order } from "./Step2Order";
import { Step3Items } from "./Step3Items";
import { Step3ItemsExchange } from "./Step3ItemsExchange";
import { Step4Refund } from "./Step4Refund";
import { Step5Contact } from "./Step5Contact";
import { Step6Review } from "./Step6Review";
import { createInitialWizardState, type WizardItemState } from "./types";
import { WIZARD_STEPS, WIZARD_STEPS_DEFAULT } from "@/lib/constants";
import type { OrderLookupResultDTO, RequestType, SubmitTicketPayload } from "@/lib/types";

export function WizardForm() {
  const router = useRouter();
  const [state, setState] = useState(createInitialWizardState);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Steps depend on the request type (ZAMENA merges items+exchange and skips the reason/refund
  // steps). Before a type is picked, fall back to the default layout — step 1 is identical for both.
  const steps = state.type ? WIZARD_STEPS[state.type] : WIZARD_STEPS_DEFAULT;
  const currentKey = steps[state.stepIndex]?.key ?? "type";

  function goNext() {
    setState((s) => ({ ...s, stepIndex: s.stepIndex + 1 }));
  }

  function goBack() {
    setState((s) => ({ ...s, stepIndex: Math.max(0, s.stepIndex - 1) }));
  }

  function handleTypeChange(type: RequestType) {
    setState((s) => ({ ...s, type }));
  }

  function handleOrderFound(order: OrderLookupResultDTO) {
    const items: WizardItemState[] = order.lineItems.map((li) => ({
      lineItemId: li.lineItemId,
      productId: li.productId,
      variantId: li.variantId,
      title: li.title,
      variantTitle: li.variantTitle,
      sku: li.sku,
      quantity: li.quantity,
      price: li.price,
      imageUrl: li.imageUrl,
      originalSize: li.originalSize,
      checked: false,
      reason: null,
      reasonText: "",
      exchangeMode: "isti",
      exchangeProductId: null,
      exchangeProductTitle: null,
      exchangeVariantId: null,
      exchangeVariantTitle: null,
      exchangeSku: null,
      exchangeSize: null,
    }));

    setState((s) => ({
      ...s,
      order,
      items,
      customerName: order.customerName || s.customerName,
      email: order.email || s.email,
      contactPhone: order.phone || s.phoneInput,
      shippingAddress: order.shippingAddress
        ? {
            address1: order.shippingAddress.address1,
            address2: order.shippingAddress.address2 ?? "",
            city: order.shippingAddress.city,
            zip: order.shippingAddress.zip,
            country: order.shippingAddress.country,
          }
        : s.shippingAddress,
      stepIndex: 2, // -> items / itemsExchange
    }));
  }

  function handleSwitchToRefund() {
    // Switching type mid-flow keeps the same step index (2), which lands on the REFUNDACIJA
    // "items" (reason) step instead of the exchange picker.
    setState((s) => ({
      ...s,
      type: "REFUNDACIJA",
      items: s.items.map((i) => ({
        ...i,
        exchangeMode: "isti",
        exchangeProductId: null,
        exchangeProductTitle: null,
        exchangeVariantId: null,
        exchangeVariantTitle: null,
        exchangeSku: null,
        exchangeSize: null,
      })),
      stepIndex: 2,
    }));
  }

  async function handleSubmit() {
    if (!state.order || !state.type) return;
    setSubmitting(true);
    setSubmitError(null);

    const isExchange = state.type === "ZAMENA";

    const payload: SubmitTicketPayload = {
      type: state.type,
      orderId: state.order.orderId,
      orderNumber: state.order.orderNumber,
      customerName: state.customerName,
      email: state.email,
      phone: state.contactPhone,
      shippingAddress: isExchange
        ? {
            address1: state.shippingAddress.address1,
            address2: state.shippingAddress.address2 || null,
            city: state.shippingAddress.city,
            zip: state.shippingAddress.zip,
            country: state.shippingAddress.country,
          }
        : null,
      items: state.items
        .filter((i) => i.checked)
        .map((i) => ({
          lineItemId: i.lineItemId,
          productId: i.productId,
          variantId: i.variantId,
          productTitle: i.title,
          variantTitle: i.variantTitle,
          sku: i.sku,
          quantity: i.quantity,
          price: i.price,
          reason: isExchange ? null : i.reason,
          reasonText: !isExchange && i.reason === "DRUGO" ? i.reasonText : null,
          originalSize: i.originalSize,
          exchangeProductId: isExchange ? i.exchangeProductId : null,
          exchangeVariantId: isExchange ? i.exchangeVariantId : null,
          exchangeVariantTitle: isExchange ? i.exchangeVariantTitle : null,
          exchangeSku: isExchange ? i.exchangeSku : null,
          exchangeSize: isExchange ? i.exchangeSize : null,
        })),
      bankAccount: isExchange ? null : state.bankAccount,
      bankAccountOwner: isExchange ? null : state.bankAccountOwner,
      goodsReceivedDate: isExchange ? null : state.goodsReceivedDate,
      refundTermsConfirmed: isExchange ? false : state.refundTermsConfirmed,
      imagePaths: state.imagePaths,
    };

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || "Greška prilikom slanja zahteva. Pokušajte ponovo.");
        return;
      }

      router.push(
        `/zahtev/potvrda?broj=${encodeURIComponent(data.ticketNumber)}&tip=${state.type}`
      );
    } catch {
      setSubmitError("Greška prilikom slanja zahteva. Pokušajte ponovo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <ProgressBar labels={steps.map((s) => s.label)} currentStep={state.stepIndex + 1} />

      {currentKey === "type" && (
        <Step1Type type={state.type} onChange={handleTypeChange} onNext={goNext} />
      )}

      {currentKey === "order" && (
        <Step2Order
          orderNumberInput={state.orderNumberInput}
          phoneInput={state.phoneInput}
          onOrderNumberChange={(v) => setState((s) => ({ ...s, orderNumberInput: v }))}
          onPhoneChange={(v) => setState((s) => ({ ...s, phoneInput: v }))}
          onFound={handleOrderFound}
          onBack={goBack}
        />
      )}

      {currentKey === "items" && (
        <Step3Items
          items={state.items}
          onChange={(items) => setState((s) => ({ ...s, items }))}
          onNext={goNext}
          onBack={goBack}
        />
      )}

      {currentKey === "itemsExchange" && (
        <Step3ItemsExchange
          items={state.items}
          onChange={(items) => setState((s) => ({ ...s, items }))}
          onNext={goNext}
          onBack={goBack}
          onSwitchToRefund={handleSwitchToRefund}
        />
      )}

      {currentKey === "refund" && (
        <Step4Refund
          bankAccount={state.bankAccount}
          bankAccountOwner={state.bankAccountOwner}
          goodsReceivedDate={state.goodsReceivedDate}
          refundTermsConfirmed={state.refundTermsConfirmed}
          onBankAccountChange={(v) => setState((s) => ({ ...s, bankAccount: v }))}
          onBankAccountOwnerChange={(v) => setState((s) => ({ ...s, bankAccountOwner: v }))}
          onGoodsReceivedDateChange={(v) => setState((s) => ({ ...s, goodsReceivedDate: v }))}
          onRefundTermsConfirmedChange={(v) => setState((s) => ({ ...s, refundTermsConfirmed: v }))}
          onNext={goNext}
          onBack={goBack}
        />
      )}

      {currentKey === "contact" && state.type && (
        <Step5Contact
          type={state.type}
          customerName={state.customerName}
          email={state.email}
          contactPhone={state.contactPhone}
          shippingAddress={state.shippingAddress}
          draftId={state.draftId}
          imagePaths={state.imagePaths}
          consentGiven={state.consentGiven}
          onCustomerNameChange={(v) => setState((s) => ({ ...s, customerName: v }))}
          onEmailChange={(v) => setState((s) => ({ ...s, email: v }))}
          onContactPhoneChange={(v) => setState((s) => ({ ...s, contactPhone: v }))}
          onShippingAddressChange={(v) => setState((s) => ({ ...s, shippingAddress: v }))}
          onImagePathsChange={(v) => setState((s) => ({ ...s, imagePaths: v }))}
          onConsentChange={(v) => setState((s) => ({ ...s, consentGiven: v }))}
          onNext={goNext}
          onBack={goBack}
        />
      )}

      {currentKey === "review" && state.type && state.order && (
        <Step6Review
          type={state.type}
          orderNumber={state.order.orderNumber}
          items={state.items}
          customerName={state.customerName}
          email={state.email}
          contactPhone={state.contactPhone}
          shippingAddress={state.shippingAddress}
          bankAccount={state.bankAccount}
          bankAccountOwner={state.bankAccountOwner}
          goodsReceivedDate={state.goodsReceivedDate}
          imagePaths={state.imagePaths}
          submitting={submitting}
          submitError={submitError}
          onSubmit={handleSubmit}
          onBack={goBack}
        />
      )}
    </div>
  );
}
