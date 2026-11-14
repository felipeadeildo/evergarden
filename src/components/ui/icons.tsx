import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { ArrowsInIcon } from "@phosphor-icons/react/dist/ssr/ArrowsIn";
import { ArrowsOutSimpleIcon } from "@phosphor-icons/react/dist/ssr/ArrowsOutSimple";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/ssr/BookmarkSimple";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { CheckIcon as PhosphorCheck } from "@phosphor-icons/react/dist/ssr/Check";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ClockCounterClockwise";
import { CopyIcon as PhosphorCopy } from "@phosphor-icons/react/dist/ssr/Copy";
import { FileTextIcon } from "@phosphor-icons/react/dist/ssr/FileText";
import { FolderIcon as PhosphorFolder } from "@phosphor-icons/react/dist/ssr/Folder";
import { GearSixIcon } from "@phosphor-icons/react/dist/ssr/GearSix";
import { GitBranchIcon } from "@phosphor-icons/react/dist/ssr/GitBranch";
import { GithubLogoIcon } from "@phosphor-icons/react/dist/ssr/GithubLogo";
import { GoogleLogoIcon } from "@phosphor-icons/react/dist/ssr/GoogleLogo";
import { InfoIcon } from "@phosphor-icons/react/dist/ssr/Info";
import { KeyIcon as PhosphorKey } from "@phosphor-icons/react/dist/ssr/Key";
import { LightbulbIcon } from "@phosphor-icons/react/dist/ssr/Lightbulb";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/ssr/ListBullets";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { MinusIcon } from "@phosphor-icons/react/dist/ssr/Minus";
import { PlugsConnectedIcon } from "@phosphor-icons/react/dist/ssr/PlugsConnected";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";
import { SignOutIcon as PhosphorSignOut } from "@phosphor-icons/react/dist/ssr/SignOut";
import { UserIcon } from "@phosphor-icons/react/dist/ssr/User";
import { WarningIcon as PhosphorWarning } from "@phosphor-icons/react/dist/ssr/Warning";
import { WarningOctagonIcon } from "@phosphor-icons/react/dist/ssr/WarningOctagon";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";

type IconProps = { className?: string };

/**
 * Every icon evergarden uses, named by what it means here. They come from Phosphor's server-safe
 * build, sized to the surrounding text and hidden from screen readers: the text next to an icon,
 * or the button's label, carries the meaning.
 */
function icon(Glyph: PhosphorIcon) {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- it renders Glyph, from this scope
  function EvergardenIcon({ className }: IconProps) {
    return (
      <Glyph
        size="1.15em"
        weight="regular"
        aria-hidden
        focusable={false}
        className={className ? `icon ${className}` : "icon"}
      />
    );
  }
  return EvergardenIcon;
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
export const GithubIcon = icon(GithubLogoIcon);
export const GoogleIcon = icon(GoogleLogoIcon);
export const ExpandIcon = icon(ArrowsOutSimpleIcon);
export const CloseIcon = icon(XIcon);
export const ZoomInIcon = icon(PlusIcon);
export const ZoomOutIcon = icon(MinusIcon);
export const FitIcon = icon(ArrowsInIcon);
export const OpenMenuIcon = icon(CaretDownIcon);
export const PersonIcon = icon(UserIcon);
export const ServerIcon = icon(PlugsConnectedIcon);
export const AddIcon = icon(PlusIcon);
export const BackIcon = icon(CaretLeftIcon);
export const ForwardIcon = icon(CaretRightIcon);

/** One icon per GitHub alert kind. */
export const CalloutIcons = {
  note: icon(InfoIcon),
  tip: icon(LightbulbIcon),
  important: icon(BookmarkSimpleIcon),
  warning: icon(PhosphorWarning),
  caution: icon(WarningOctagonIcon),
};
