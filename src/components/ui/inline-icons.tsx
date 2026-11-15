import { ArrowDownIcon } from "@phosphor-icons/react/dist/ssr/ArrowDown";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ArrowUpIcon } from "@phosphor-icons/react/dist/ssr/ArrowUp";
import { BellIcon } from "@phosphor-icons/react/dist/ssr/Bell";
import { BookIcon } from "@phosphor-icons/react/dist/ssr/Book";
import { BrainIcon } from "@phosphor-icons/react/dist/ssr/Brain";
import { BugIcon } from "@phosphor-icons/react/dist/ssr/Bug";
import { CalendarIcon } from "@phosphor-icons/react/dist/ssr/Calendar";
import { ChartBarIcon } from "@phosphor-icons/react/dist/ssr/ChartBar";
import { ChartLineIcon } from "@phosphor-icons/react/dist/ssr/ChartLine";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/ssr/ChatCircle";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { ClockIcon } from "@phosphor-icons/react/dist/ssr/Clock";
import { CloudIcon } from "@phosphor-icons/react/dist/ssr/Cloud";
import { CodeIcon } from "@phosphor-icons/react/dist/ssr/Code";
import { CoffeeIcon } from "@phosphor-icons/react/dist/ssr/Coffee";
import { CpuIcon } from "@phosphor-icons/react/dist/ssr/Cpu";
import { CurrencyDollarIcon } from "@phosphor-icons/react/dist/ssr/CurrencyDollar";
import { DatabaseIcon } from "@phosphor-icons/react/dist/ssr/Database";
import { EnvelopeIcon } from "@phosphor-icons/react/dist/ssr/Envelope";
import { EyeIcon } from "@phosphor-icons/react/dist/ssr/Eye";
import { FileIcon } from "@phosphor-icons/react/dist/ssr/File";
import { FireIcon } from "@phosphor-icons/react/dist/ssr/Fire";
import { FlagIcon } from "@phosphor-icons/react/dist/ssr/Flag";
import { FolderIcon } from "@phosphor-icons/react/dist/ssr/Folder";
import { GaugeIcon } from "@phosphor-icons/react/dist/ssr/Gauge";
import { GearIcon } from "@phosphor-icons/react/dist/ssr/Gear";
import { GitBranchIcon } from "@phosphor-icons/react/dist/ssr/GitBranch";
import { GitPullRequestIcon } from "@phosphor-icons/react/dist/ssr/GitPullRequest";
import { GlobeIcon } from "@phosphor-icons/react/dist/ssr/Globe";
import { GraduationCapIcon } from "@phosphor-icons/react/dist/ssr/GraduationCap";
import { HammerIcon } from "@phosphor-icons/react/dist/ssr/Hammer";
import { HardDrivesIcon } from "@phosphor-icons/react/dist/ssr/HardDrives";
import { HeartIcon } from "@phosphor-icons/react/dist/ssr/Heart";
import { HourglassIcon } from "@phosphor-icons/react/dist/ssr/Hourglass";
import { HouseIcon } from "@phosphor-icons/react/dist/ssr/House";
import { InfoIcon } from "@phosphor-icons/react/dist/ssr/Info";
import { KeyIcon } from "@phosphor-icons/react/dist/ssr/Key";
import { LightbulbIcon } from "@phosphor-icons/react/dist/ssr/Lightbulb";
import { LightningIcon } from "@phosphor-icons/react/dist/ssr/Lightning";
import { LinkIcon } from "@phosphor-icons/react/dist/ssr/Link";
import { ListChecksIcon } from "@phosphor-icons/react/dist/ssr/ListChecks";
import { LockIcon } from "@phosphor-icons/react/dist/ssr/Lock";
import { LockOpenIcon } from "@phosphor-icons/react/dist/ssr/LockOpen";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin";
import { MegaphoneIcon } from "@phosphor-icons/react/dist/ssr/Megaphone";
import { MinusIcon } from "@phosphor-icons/react/dist/ssr/Minus";
import { MoneyIcon } from "@phosphor-icons/react/dist/ssr/Money";
import { PackageIcon } from "@phosphor-icons/react/dist/ssr/Package";
import { PencilIcon } from "@phosphor-icons/react/dist/ssr/Pencil";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";
import { ProhibitIcon } from "@phosphor-icons/react/dist/ssr/Prohibit";
import { PuzzlePieceIcon } from "@phosphor-icons/react/dist/ssr/PuzzlePiece";
import { QuestionIcon } from "@phosphor-icons/react/dist/ssr/Question";
import { RobotIcon } from "@phosphor-icons/react/dist/ssr/Robot";
import { RocketIcon } from "@phosphor-icons/react/dist/ssr/Rocket";
import { RocketLaunchIcon } from "@phosphor-icons/react/dist/ssr/RocketLaunch";
import { ScalesIcon } from "@phosphor-icons/react/dist/ssr/Scales";
import { ShieldIcon } from "@phosphor-icons/react/dist/ssr/Shield";
import { SparkleIcon } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { StarIcon } from "@phosphor-icons/react/dist/ssr/Star";
import { TargetIcon } from "@phosphor-icons/react/dist/ssr/Target";
import { TerminalIcon } from "@phosphor-icons/react/dist/ssr/Terminal";
import { ThumbsDownIcon } from "@phosphor-icons/react/dist/ssr/ThumbsDown";
import { ThumbsUpIcon } from "@phosphor-icons/react/dist/ssr/ThumbsUp";
import { TimerIcon } from "@phosphor-icons/react/dist/ssr/Timer";
import { TrashIcon } from "@phosphor-icons/react/dist/ssr/Trash";
import { TrendDownIcon } from "@phosphor-icons/react/dist/ssr/TrendDown";
import { TrendUpIcon } from "@phosphor-icons/react/dist/ssr/TrendUp";
import { UserIcon } from "@phosphor-icons/react/dist/ssr/User";
import { UsersIcon } from "@phosphor-icons/react/dist/ssr/Users";
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { WrenchIcon } from "@phosphor-icons/react/dist/ssr/Wrench";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { XCircleIcon } from "@phosphor-icons/react/dist/ssr/XCircle";

import type { IconName } from "#/render/icons";

import { icon } from "./icons";

/** What `:icon[name]` draws in a document. */
export const INLINE_ICONS: Record<IconName, ReturnType<typeof icon>> = {
  check: icon(CheckIcon),
  "check-circle": icon(CheckCircleIcon),
  x: icon(XIcon),
  "x-circle": icon(XCircleIcon),
  warning: icon(WarningIcon),
  "warning-circle": icon(WarningCircleIcon),
  info: icon(InfoIcon),
  question: icon(QuestionIcon),
  lightbulb: icon(LightbulbIcon),
  rocket: icon(RocketIcon),
  "rocket-launch": icon(RocketLaunchIcon),
  flag: icon(FlagIcon),
  target: icon(TargetIcon),
  clock: icon(ClockIcon),
  calendar: icon(CalendarIcon),
  hourglass: icon(HourglassIcon),
  timer: icon(TimerIcon),
  lightning: icon(LightningIcon),
  fire: icon(FireIcon),
  star: icon(StarIcon),
  heart: icon(HeartIcon),
  sparkle: icon(SparkleIcon),
  "thumbs-up": icon(ThumbsUpIcon),
  "thumbs-down": icon(ThumbsDownIcon),
  bug: icon(BugIcon),
  wrench: icon(WrenchIcon),
  hammer: icon(HammerIcon),
  gear: icon(GearIcon),
  gauge: icon(GaugeIcon),
  lock: icon(LockIcon),
  "lock-open": icon(LockOpenIcon),
  key: icon(KeyIcon),
  shield: icon(ShieldIcon),
  prohibit: icon(ProhibitIcon),
  user: icon(UserIcon),
  users: icon(UsersIcon),
  robot: icon(RobotIcon),
  brain: icon(BrainIcon),
  "chat-circle": icon(ChatCircleIcon),
  envelope: icon(EnvelopeIcon),
  megaphone: icon(MegaphoneIcon),
  bell: icon(BellIcon),
  link: icon(LinkIcon),
  globe: icon(GlobeIcon),
  cloud: icon(CloudIcon),
  database: icon(DatabaseIcon),
  "hard-drives": icon(HardDrivesIcon),
  cpu: icon(CpuIcon),
  code: icon(CodeIcon),
  terminal: icon(TerminalIcon),
  "git-branch": icon(GitBranchIcon),
  "git-pull-request": icon(GitPullRequestIcon),
  package: icon(PackageIcon),
  file: icon(FileIcon),
  folder: icon(FolderIcon),
  "list-checks": icon(ListChecksIcon),
  "chart-line": icon(ChartLineIcon),
  "chart-bar": icon(ChartBarIcon),
  "trend-up": icon(TrendUpIcon),
  "trend-down": icon(TrendDownIcon),
  "currency-dollar": icon(CurrencyDollarIcon),
  money: icon(MoneyIcon),
  scales: icon(ScalesIcon),
  "arrow-right": icon(ArrowRightIcon),
  "arrow-up": icon(ArrowUpIcon),
  "arrow-down": icon(ArrowDownIcon),
  plus: icon(PlusIcon),
  minus: icon(MinusIcon),
  pencil: icon(PencilIcon),
  trash: icon(TrashIcon),
  eye: icon(EyeIcon),
  "magnifying-glass": icon(MagnifyingGlassIcon),
  book: icon(BookIcon),
  "graduation-cap": icon(GraduationCapIcon),
  "puzzle-piece": icon(PuzzlePieceIcon),
  coffee: icon(CoffeeIcon),
  house: icon(HouseIcon),
  "map-pin": icon(MapPinIcon),
};
