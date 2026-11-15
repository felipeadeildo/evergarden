import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ArrowCounterClockwise";
import { ArrowsInIcon } from "@phosphor-icons/react/dist/ssr/ArrowsIn";
import { ArrowsOutSimpleIcon } from "@phosphor-icons/react/dist/ssr/ArrowsOutSimple";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/ssr/BookmarkSimple";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { ChatCircleTextIcon } from "@phosphor-icons/react/dist/ssr/ChatCircleText";
import { CheckIcon as PhosphorCheck } from "@phosphor-icons/react/dist/ssr/Check";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ClockCounterClockwise";
import { CopyIcon as PhosphorCopy } from "@phosphor-icons/react/dist/ssr/Copy";
import { FileTextIcon } from "@phosphor-icons/react/dist/ssr/FileText";
import { FolderIcon as PhosphorFolder } from "@phosphor-icons/react/dist/ssr/Folder";
import { GearSixIcon } from "@phosphor-icons/react/dist/ssr/GearSix";
import { GitBranchIcon } from "@phosphor-icons/react/dist/ssr/GitBranch";
import { InfoIcon } from "@phosphor-icons/react/dist/ssr/Info";
import { KeyIcon as PhosphorKey } from "@phosphor-icons/react/dist/ssr/Key";
import { LightbulbIcon } from "@phosphor-icons/react/dist/ssr/Lightbulb";
import { LinkSimpleIcon } from "@phosphor-icons/react/dist/ssr/LinkSimple";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/ssr/ListBullets";
import { LockSimpleIcon } from "@phosphor-icons/react/dist/ssr/LockSimple";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { MinusIcon } from "@phosphor-icons/react/dist/ssr/Minus";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/ssr/PencilSimple";
import { PlugsConnectedIcon } from "@phosphor-icons/react/dist/ssr/PlugsConnected";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";
import { SignOutIcon as PhosphorSignOut } from "@phosphor-icons/react/dist/ssr/SignOut";
import { UserIcon } from "@phosphor-icons/react/dist/ssr/User";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr/UsersThree";
import { WarningIcon as PhosphorWarning } from "@phosphor-icons/react/dist/ssr/Warning";
import { WarningOctagonIcon } from "@phosphor-icons/react/dist/ssr/WarningOctagon";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";

type IconProps = { className?: string };

/** Hidden from screen readers: the text or label beside an icon carries its meaning. */
function icon(Glyph: PhosphorIcon) {
  return ({ className }: IconProps) => (
    <Glyph
      size="1.15em"
      weight="regular"
      aria-hidden
      focusable={false}
      className={className ? `icon ${className}` : "icon"}
    />
  );
}

export const SearchIcon = icon(MagnifyingGlassIcon);
export const SettingsIcon = icon(GearSixIcon);
export const ContentsIcon = icon(ListBulletsIcon);
export const FolderIcon = icon(PhosphorFolder);
export const DocumentIcon = icon(FileTextIcon);
export const RepositoryIcon = icon(GitBranchIcon);
export const CopyIcon = icon(PhosphorCopy);
export const CheckIcon = icon(PhosphorCheck);
export const HistoryIcon = icon(ClockCounterClockwiseIcon);
export const KeyIcon = icon(PhosphorKey);
export const SignOutIcon = icon(PhosphorSignOut);
export const ExpandIcon = icon(ArrowsOutSimpleIcon);
export const CloseIcon = icon(XIcon);
export const ZoomInIcon = icon(PlusIcon);
export const ZoomOutIcon = icon(MinusIcon);
export const FitIcon = icon(ArrowsInIcon);
export const OpenMenuIcon = icon(CaretDownIcon);
export const CommentIcon = icon(ChatCircleTextIcon);
export const ShareIcon = icon(LinkSimpleIcon);
export const PrivateIcon = icon(LockSimpleIcon);
export const PeopleIcon = icon(UsersThreeIcon);
export const EditIcon = icon(PencilSimpleIcon);
export const ReopenIcon = icon(ArrowCounterClockwiseIcon);
export const PersonIcon = icon(UserIcon);
export const ServerIcon = icon(PlugsConnectedIcon);
export const AddIcon = icon(PlusIcon);
export const BackIcon = icon(CaretLeftIcon);
export const ForwardIcon = icon(CaretRightIcon);

export const CalloutIcons = {
  note: icon(InfoIcon),
  tip: icon(LightbulbIcon),
  important: icon(BookmarkSimpleIcon),
  warning: icon(PhosphorWarning),
  caution: icon(WarningOctagonIcon),
};
