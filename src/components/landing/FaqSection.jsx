import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = [
    {
      question: 'Does FlowBiz work when there is no internet connection?',
      answer: 'Yes. FlowBiz uses an offline-first architecture with persistent local caching. Sales, credit purchases, and expenses are saved immediately in your browser or phone storage and sync automatically with the cloud database the moment connectivity is restored.',
    },
    {
      question: 'How does M-Pesa reconciliation work at closing time?',
      answer: 'When recording sales, cashiers specify whether the payment was received via Cash or M-Pesa (along with the M-Pesa transaction code). At the end of the shift on the Close Day page, FlowBiz calculates the exact expected M-Pesa sum so you can reconcile it directly against your M-Pesa Till or Paybill balance.',
    },
    {
      question: 'Why does profit stay at zero when I record a Credit (Deni) sale?',
      answer: 'FlowBiz uses a cash-flow-first accounting model specifically designed for retail businesses. While physical stock is deducted immediately to prevent double-selling, revenue and gross profit are only recognized when the customer pays off their debt. This prevents false profit illusions on uncollected credit.',
    },
    {
      question: 'Do I need to purchase specialized POS hardware or barcode scanners?',
      answer: 'No. FlowBiz runs directly in any modern web browser or as an installed app on Android, iOS, Windows, or Mac. You can use your phone camera to scan barcodes, or plug in standard USB/Bluetooth handheld barcode scanners and 58mm/80mm thermal receipt printers.',
    },
    {
      question: 'Can my cashiers see my profit margins and wholesale buying costs?',
      answer: 'No. Staff accounts have strict role separation. Cashiers only have access to the POS Counter, Customer Lookup, and authorized expense logging. Sensitive reports, profit calculations, inventory intelligence, and system settings are strictly reserved for Business Owners.',
    },
    {
      question: 'How do digital WhatsApp receipts work without extra fees?',
      answer: 'FlowBiz generates a secure, lightweight document link and opens a pre-formatted WhatsApp chat directly on your device with one tap. This avoids expensive monthly WhatsApp Business Cloud API charges or SMS subscription costs.',
    },
  ];

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-16 md:py-24 border-t border-[#e8eaed] bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3">
         
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#15171d] tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-[#5a6273]">
            Everything you need to know about setting up and running FlowBiz in your shop.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="border-b border-[#e8eaed] pb-4 transition-all">
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between gap-4 text-left font-bold text-[#15171d] text-sm sm:text-base py-2 hover:text-[#1a623c] transition-colors"
                >
                  <span>{faq.question}</span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-[#1a623c] shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#767f8f] shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <p className="text-xs sm:text-sm text-[#5a6273] leading-relaxed pt-2 pb-1">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}