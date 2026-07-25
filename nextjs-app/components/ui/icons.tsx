/**
 * Sistema de iconos SVG — RIPS Guard
 * Iconos inline, sin dependencias externas, optimizados para B2B.
 */

interface IconProps {
  size?: number
  className?: string
  strokeWidth?: number
}

const base = (paths: React.ReactNode, size = 18, className = '', sw = 1.75) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {paths}
  </svg>
)

export function HomeIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </>,
    size, className, strokeWidth
  )
}

export function SearchIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </>,
    size, className, strokeWidth
  )
}

export function HistoryIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </>,
    size, className, strokeWidth
  )
}

export function CreditCardIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <rect width="22" height="16" x="1" y="4" rx="2" />
      <path d="M1 10h22" />
    </>,
    size, className, strokeWidth
  )
}

export function LogOutIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>,
    size, className, strokeWidth
  )
}

export function UploadIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>,
    size, className, strokeWidth
  )
}

export function FileTextIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </>,
    size, className, strokeWidth
  )
}

export function CheckCircleIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </>,
    size, className, strokeWidth
  )
}

export function XCircleIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </>,
    size, className, strokeWidth
  )
}

export function AlertTriangleIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>,
    size, className, strokeWidth
  )
}

export function AlertCircleIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>,
    size, className, strokeWidth
  )
}

export function ZapIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></>,
    size, className, strokeWidth
  )
}

export function BotIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <rect width="18" height="10" x="3" y="11" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </>,
    size, className, strokeWidth
  )
}

export function CheckIcon({ size = 18, className = '', strokeWidth = 2 }: IconProps) {
  return base(
    <polyline points="20 6 9 17 4 12" />,
    size, className, strokeWidth
  )
}

export function ChevronDownIcon({ size = 18, className = '', strokeWidth = 2 }: IconProps) {
  return base(
    <polyline points="6 9 12 15 18 9" />,
    size, className, strokeWidth
  )
}

export function ChevronUpIcon({ size = 18, className = '', strokeWidth = 2 }: IconProps) {
  return base(
    <polyline points="18 15 12 9 6 15" />,
    size, className, strokeWidth
  )
}

export function ClockIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>,
    size, className, strokeWidth
  )
}

export function ShieldIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    size, className, strokeWidth
  )
}

export function BarChartIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </>,
    size, className, strokeWidth
  )
}

export function ExternalLinkIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </>,
    size, className, strokeWidth
  )
}

export function RefreshIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </>,
    size, className, strokeWidth
  )
}

export function LockIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>,
    size, className, strokeWidth
  )
}

export function MailIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>,
    size, className, strokeWidth
  )
}

export function UserIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>,
    size, className, strokeWidth
  )
}

export function XIcon({ size = 18, className = '', strokeWidth = 2 }: IconProps) {
  return base(
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>,
    size, className, strokeWidth
  )
}

export function InfoIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </>,
    size, className, strokeWidth
  )
}

export function DownloadIcon({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return base(
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>,
    size, className, strokeWidth
  )
}
