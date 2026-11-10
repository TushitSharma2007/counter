import { upiIntentAdapter } from '@repo/payments';
import { Button, Icon, formatINR } from '@repo/ui';
import { Maximize2, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** A UPI QR for the customer to scan. The cashier confirms when the money shows on their phone. */
export function UpiQr({
  vpa,
  payeeName,
  amountPaise,
  note,
}: {
  vpa: string;
  payeeName: string;
  amountPaise: number;
  note: string;
}) {
  const [image, setImage] = useState<string>();
  const [full, setFull] = useState(false);

  useEffect(() => {
    let live = true;
    const { uri } = upiIntentAdapter({ vpa, name: payeeName }).request({ amountPaise, note });
    QRCode.toDataURL(uri, { margin: 1, width: 640, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (live) setImage(url);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [vpa, payeeName, amountPaise, note]);

  if (!image) return <div className="aspect-square w-56 animate-pulse rounded-md bg-sunken" />;

  return (
    <>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <img
          src={image}
          alt={`UPI QR for ${formatINR(amountPaise)} to ${vpa}`}
          className="aspect-square w-56 rounded-md border border-line bg-receipt p-1"
        />
        <div className="flex flex-col gap-2 text-base">
          <p>Customer scans with any UPI app. Confirm once the money shows on your phone.</p>
          <p className="text-sm text-ink-2">To {vpa}</p>
          <Button
            className="self-start"
            onClick={() => {
              setFull(true);
            }}
          >
            <Icon icon={Maximize2} size={18} />
            Show the customer
          </Button>
        </div>
      </div>

      {full ? (
        <div
          role="dialog"
          aria-label="UPI QR for the customer"
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-receipt p-6 text-receipt-ink"
        >
          <p className="text-xl font-semibold">{payeeName}</p>
          <p className="num font-display text-[56px] leading-none font-semibold">
            {formatINR(amountPaise)}
          </p>
          <img src={image} alt="" className="aspect-square w-[min(80vw,60vh)]" />
          <p className="text-lg">Scan with any UPI app to pay</p>
          <button
            type="button"
            onClick={() => {
              setFull(false);
            }}
            className="absolute top-4 right-4 flex h-12 items-center gap-2 rounded-md border border-receipt-ink/30 px-4 text-base font-medium"
          >
            <Icon icon={X} size={18} />
            Back
          </button>
        </div>
      ) : null}
    </>
  );
}
