/**
 * Clinic Clarity — Custom UI Component Library
 * Zero HeroUI dependency. Import from here for all UI components.
 *
 * Usage:
 *   import { Button, Input, Card } from "@/components/ui"
 */

export { Button } from "./button";
export type { ButtonProps } from "./button";

export { Avatar } from "./avatar";
export type { AvatarProps } from "./avatar";

export { Card, CardHeader, CardBody, CardFooter } from "./card";
export type { CardProps } from "./card";

export { Input, Textarea } from "./input";
export type { InputProps, TextareaProps } from "./input";

export { Spinner } from "./spinner";
export type { SpinnerProps } from "./spinner";

export { Divider } from "./divider";
export type { DividerProps } from "./divider";

export {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
} from "./dropdown";
export type {
  DropdownProps,
  DropdownMenuProps,
  DropdownItemProps,
  DropdownSectionProps,
} from "./dropdown";

export { ToastProvider, addToast, toast, useToast } from "./toast";
export type { ToastOptions, ToastColor } from "./toast";

export { Badge } from "./badge";
export { Chip } from "./chip";
export { Switch } from "./switch";
export { Checkbox } from "./checkbox";
export { Link } from "./link";
export { Tabs, Tab } from "./tabs";
export { Select, SelectItem } from "./select";
export { Pagination } from "./pagination";
export { Progress } from "./progress";
export {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
} from "./table";
export {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "./modal";
export { Skeleton, TableSkeleton, CardSkeleton, ListSkeleton, PageSkeleton } from "./skeleton";
export type { SkeletonProps } from "./skeleton";
