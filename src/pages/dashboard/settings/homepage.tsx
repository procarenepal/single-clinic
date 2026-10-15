import { useState, useEffect, useRef, ReactNode } from "react";
import {
  IoAddOutline,
  IoArrowBackOutline,
  IoArrowDownOutline,
  IoArrowUpOutline,
  IoChevronDownOutline,
  IoCloudUploadOutline,
  IoEyeOutline,
  IoRefreshOutline,
  IoSaveOutline,
  IoTrashOutline,
  IoWarningOutline,
} from "react-icons/io5";
import { Link } from "react-router-dom";

import { title, subtitle } from "@/components/primitives";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { useAuthContext } from "@/context/AuthContext";
import { addToast } from "@/components/ui/toast";
import {
  landingPageService,
  LandingPageContent,
  DEFAULT_CONTENT,
  PUBLIC_HOMEPAGE_CLINIC_ID,
} from "@/services/landingPageService";
import { uploadFileToFirebase } from "@/services/firebaseStorageService";
import { HOMEPAGE_ICON_NAMES } from "@/utils/homepageIcons";

type Content = LandingPageContent;
type SectionKey = keyof Content["sections"];

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // matches the storage rule for this path

// ───────────────────────────── small building blocks ─────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  hint,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
  rows?: number;
}) {
  return multiline ? (
    <Textarea
      description={hint}
      label={label}
      rows={rows}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ) : (
    <Input
      description={hint}
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Grid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted pt-2">
      {children}
    </p>
  );
}

function IconSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs font-medium text-text-main">{label}</label>
      <select
        className="h-10 rounded border border-border-base bg-surface px-2 text-xs text-text-main focus:outline-none focus:border-primary"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {!HOMEPAGE_ICON_NAMES.includes(value) && value && (
          <option value={value}>{value}</option>
        )}
        {HOMEPAGE_ICON_NAMES.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}

/** An image: shows a preview, takes a URL / site path, or uploads a file. */
function ImageField({
  label,
  value,
  onChange,
  clinicId,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  clinicId: string;
  hint?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addToast({ title: "Choose an image file", color: "warning" });

      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      addToast({
        title: "Image too large",
        description: "Please use an image under 3 MB.",
        color: "warning",
      });

      return;
    }
    setProgress(0);
    try {
      const { url } = await uploadFileToFirebase(
        file,
        `clinic-gallery/${clinicId}/homepage`,
        (p) => setProgress(Math.round(p)),
      );

      onChange(url);
      addToast({ title: "Image uploaded", color: "success" });
    } catch (error: any) {
      addToast({
        title: "Upload failed",
        description:
          error?.code === "storage/unauthorized"
            ? "You don't have permission to upload. Paste an image URL instead."
            : "Could not upload the image. You can paste an image URL instead.",
        color: "danger",
      });
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-text-main">{label}</label>
      <div className="flex items-start gap-3">
        <div className="w-20 h-20 rounded-lg border border-border-base bg-surface-2 overflow-hidden flex items-center justify-center shrink-0">
          {value ? (
            <img alt="" className="w-full h-full object-cover" src={value} />
          ) : (
            <span className="text-[10px] text-text-muted">No image</span>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <Input
            placeholder="https://… or /images/…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              accept="image/*"
              className="hidden"
              type="file"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Button
              isLoading={progress !== null}
              size="sm"
              startContent={<IoCloudUploadOutline />}
              type="button"
              variant="bordered"
              onClick={() => fileRef.current?.click()}
            >
              {progress !== null ? `Uploading ${progress}%` : "Upload image"}
            </Button>
            {value && (
              <Button
                size="sm"
                type="button"
                variant="light"
                onClick={() => onChange("")}
              >
                Remove
              </Button>
            )}
          </div>
          {hint && <p className="text-[11px] text-text-muted">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

/** Add / remove / reorder a list of objects. */
function ItemList<T>({
  items,
  onChange,
  create,
  itemTitle,
  addLabel,
  render,
  min = 0,
  max,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  itemTitle: (item: T, index: number) => string;
  addLabel: string;
  render: (
    item: T,
    update: (patch: Partial<T>) => void,
    index: number,
  ) => ReactNode;
  min?: number;
  max?: number;
}) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);

    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-xl border border-border-base bg-surface-2/40 p-4 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-text-main truncate">
              {itemTitle(item, i) || `Item ${i + 1}`}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                isDisabled={i === 0}
                isIconOnly
                size="sm"
                type="button"
                variant="light"
                onClick={() => move(i, i - 1)}
              >
                <IoArrowUpOutline />
              </Button>
              <Button
                isDisabled={i === items.length - 1}
                isIconOnly
                size="sm"
                type="button"
                variant="light"
                onClick={() => move(i, i + 1)}
              >
                <IoArrowDownOutline />
              </Button>
              <Button
                color="danger"
                isDisabled={items.length <= min}
                isIconOnly
                size="sm"
                type="button"
                variant="light"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <IoTrashOutline />
              </Button>
            </div>
          </div>
          {render(
            item,
            (patch) =>
              onChange(
                items.map((it, j) => (j === i ? { ...it, ...patch } : it)),
              ),
            i,
          )}
        </div>
      ))}
      {(max === undefined || items.length < max) && (
        <div>
          <Button
            size="sm"
            startContent={<IoAddOutline />}
            type="button"
            variant="bordered"
            onClick={() => onChange([...items, create()])}
          >
            {addLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

/** A list of plain text values. */
function StringList({
  label,
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-text-main">{label}</label>
      {items.map((value, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              placeholder={placeholder}
              value={value}
              onChange={(e) =>
                onChange(items.map((v, j) => (j === i ? e.target.value : v)))
              }
            />
          </div>
          <Button
            color="danger"
            isIconOnly
            size="sm"
            type="button"
            variant="light"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <IoTrashOutline />
          </Button>
        </div>
      ))}
      <div>
        <Button
          size="sm"
          startContent={<IoAddOutline />}
          type="button"
          variant="bordered"
          onClick={() => onChange([...items, ""])}
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

/** A collapsible settings section, optionally with a show/hide switch. */
function Section({
  title: heading,
  description,
  open,
  onToggle,
  visible,
  onVisibleChange,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  visible?: boolean;
  onVisibleChange?: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          className="flex-1 flex items-center gap-3 text-left min-w-0"
          type="button"
          onClick={onToggle}
        >
          <IoChevronDownOutline
            className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <span className="min-w-0">
            <span className="block text-md font-bold text-text-main">
              {heading}
            </span>
            <span className="block text-small text-text-muted truncate">
              {description}
            </span>
          </span>
        </button>
        {onVisibleChange && (
          <Switch
            isSelected={!!visible}
            label={visible ? "Shown" : "Hidden"}
            onValueChange={onVisibleChange}
          />
        )}
      </div>
      {open && (
        <CardBody className="gap-4 border-t border-border-base py-5">
          {children}
        </CardBody>
      )}
    </Card>
  );
}

// ───────────────────────────── the page ──────────────────────────────────────

export default function HomepageSettingsPage() {
  const { clinicId } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [content, setContent] = useState<Content | null>(null);
  const [openSection, setOpenSection] = useState<string | null>("hero");

  useEffect(() => {
    const loadContent = async () => {
      if (!clinicId) return;
      try {
        setContent(await landingPageService.getHomepageContent(clinicId));
      } catch (error) {
        addToast({
          title: "Error",
          description: "Failed to load homepage content",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [clinicId]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** Edit a copy of the content in place, then store it. */
  const edit = (fn: (draft: Content) => void) => {
    setContent((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);

      fn(next);

      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!clinicId || !content) return;
    setSaving(true);
    try {
      await landingPageService.updateHomepageContent(clinicId, content);
      setDirty(false);
      addToast({
        title: "Saved",
        description: "Homepage content updated. Refresh the site to see it.",
        color: "success",
      });
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to save content",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (
      !window.confirm(
        "Replace everything on this page with the original default content? Nothing is saved until you press Save Changes.",
      )
    )
      return;
    setContent(structuredClone(DEFAULT_CONTENT));
    setDirty(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!content || !clinicId) return null;

  const c = content;
  const toggle = (id: string) =>
    setOpenSection((cur) => (cur === id ? null : id));
  const sectionProps = (id: string, key?: SectionKey) => ({
    open: openSection === id,
    onToggle: () => toggle(id),
    ...(key
      ? {
          visible: c.sections[key],
          onVisibleChange: (v: boolean) =>
            edit((d) => {
              d.sections[key] = v;
            }),
        }
      : {}),
  });

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={title({ size: "lg" })}>Homepage Management</h1>
          <p className={subtitle({ class: "mt-1" })}>
            Everything on the public home page is edited here
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dirty && (
            <span className="text-xs font-medium text-warning-600">
              Unsaved changes
            </span>
          )}
          <Link to="/dashboard/settings">
            <Button startContent={<IoArrowBackOutline />} variant="light">
              Back
            </Button>
          </Link>
          <a href="/" rel="noreferrer" target="_blank">
            <Button startContent={<IoEyeOutline />} variant="bordered">
              View site
            </Button>
          </a>
          <Button
            startContent={<IoRefreshOutline />}
            variant="light"
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            color="primary"
            isLoading={saving}
            startContent={<IoSaveOutline />}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </div>
      </div>

      {clinicId !== PUBLIC_HOMEPAGE_CLINIC_ID && (
        <div className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          <IoWarningOutline className="mt-0.5 shrink-0" />
          <span>
            The public site shows the content saved under “
            {PUBLIC_HOMEPAGE_CLINIC_ID}”, but you are editing “{clinicId}”. Your
            changes will not appear on the site. Set{" "}
            <code>VITE_HOMEPAGE_CLINIC_ID={clinicId}</code> in the site’s
            environment to fix this.
          </span>
        </div>
      )}

      <p className="text-xs text-text-muted -mt-2">
        Use the switch on a section to show or hide it on the site. Images can
        be uploaded (up to 3 MB) or pasted as a link. Changes go live after{" "}
        <b>Save Changes</b>.
      </p>

      <div className="flex flex-col gap-3">
        {/* ── Hero ── */}
        <Section
          description="The first thing visitors see"
          title="Hero"
          {...sectionProps("hero")}
        >
          <Field
            label="Small label above the title"
            value={c.hero.eyebrow}
            onChange={(v) => edit((d) => void (d.hero.eyebrow = v))}
          />
          <Field
            hint="The last word is shown in italic brand colour."
            label="Main title"
            value={c.hero.title}
            onChange={(v) => edit((d) => void (d.hero.title = v))}
          />
          <Field
            label="Subtitle"
            multiline
            value={c.hero.subtitle}
            onChange={(v) => edit((d) => void (d.hero.subtitle = v))}
          />
          <Grid>
            <Field
              label="Main button text"
              value={c.hero.ctaText}
              onChange={(v) => edit((d) => void (d.hero.ctaText = v))}
            />
            <Field
              hint="A page like /login, a full https:// link, or #section"
              label="Main button link"
              value={c.hero.ctaLink}
              onChange={(v) => edit((d) => void (d.hero.ctaLink = v))}
            />
            <Field
              hint="Leave empty to hide the second button."
              label="Second button text"
              value={c.hero.secondaryCtaText}
              onChange={(v) => edit((d) => void (d.hero.secondaryCtaText = v))}
            />
            <Field
              label="Second button link"
              value={c.hero.secondaryCtaLink}
              onChange={(v) => edit((d) => void (d.hero.secondaryCtaLink = v))}
            />
          </Grid>

          <SubHeading>Image slideshow</SubHeading>
          <ItemList
            addLabel="Add slide"
            create={() => ({ imageUrl: "", kicker: "", caption: "" })}
            itemTitle={(s, i) => s.caption || `Slide ${i + 1}`}
            items={c.hero.slides}
            min={1}
            render={(s, update) => (
              <>
                <ImageField
                  clinicId={clinicId}
                  label="Image"
                  value={s.imageUrl}
                  onChange={(v) => update({ imageUrl: v })}
                />
                <Grid>
                  <Field
                    label="Small caption (shown on hover)"
                    value={s.kicker}
                    onChange={(v) => update({ kicker: v })}
                  />
                  <Field
                    label="Caption"
                    value={s.caption}
                    onChange={(v) => update({ caption: v })}
                  />
                </Grid>
              </>
            )}
            onChange={(items) => edit((d) => void (d.hero.slides = items))}
          />

          <SubHeading>Trust row (patient photos + rating)</SubHeading>
          <StringList
            addLabel="Add photo"
            items={c.hero.trustAvatars}
            label="Patient photo links"
            placeholder="https://…"
            onChange={(items) =>
              edit((d) => void (d.hero.trustAvatars = items))
            }
          />
          <Grid>
            <Field
              label="Rating"
              value={c.hero.trustRating}
              onChange={(v) => edit((d) => void (d.hero.trustRating = v))}
            />
            <Field
              label="Text under the rating"
              value={c.hero.trustText}
              onChange={(v) => edit((d) => void (d.hero.trustText = v))}
            />
          </Grid>

          <SubHeading>Rating card on the image</SubHeading>
          <Grid>
            <Field
              label="Rating"
              value={c.hero.ratingValue}
              onChange={(v) => edit((d) => void (d.hero.ratingValue = v))}
            />
            <Field
              label="Label"
              value={c.hero.ratingLabel}
              onChange={(v) => edit((d) => void (d.hero.ratingLabel = v))}
            />
          </Grid>

          <SubHeading>Specialist card on the image</SubHeading>
          <Grid>
            <Field
              label="Name"
              value={c.hero.specialistName}
              onChange={(v) => edit((d) => void (d.hero.specialistName = v))}
            />
            <Field
              label="Role"
              value={c.hero.specialistRole}
              onChange={(v) => edit((d) => void (d.hero.specialistRole = v))}
            />
            <Field
              hint="Where the card goes when clicked, e.g. #team"
              label="Link"
              value={c.hero.specialistLink}
              onChange={(v) => edit((d) => void (d.hero.specialistLink = v))}
            />
          </Grid>
          <ImageField
            clinicId={clinicId}
            label="Photo"
            value={c.hero.specialistImageUrl}
            onChange={(v) => edit((d) => void (d.hero.specialistImageUrl = v))}
          />
        </Section>

        {/* ── Stats ── */}
        <Section
          description="The row of numbers under the hero"
          title="Trust indicators (stats)"
          {...sectionProps("stats", "stats")}
        >
          <ItemList
            addLabel="Add stat"
            create={() => ({
              number: "",
              label: "",
              icon: "Star",
              imageUrl: "",
            })}
            itemTitle={(s) => `${s.number} ${s.label}`.trim()}
            items={c.stats}
            max={6}
            min={1}
            render={(s, update) => (
              <>
                <Grid>
                  <Field
                    hint="Counts up from 0 when it appears, e.g. 5k+, 100%, 4.9/5"
                    label="Number"
                    value={s.number}
                    onChange={(v) => update({ number: v })}
                  />
                  <Field
                    label="Label"
                    value={s.label}
                    onChange={(v) => update({ label: v })}
                  />
                </Grid>
                <IconSelect
                  label="Icon (used when there is no image)"
                  value={s.icon}
                  onChange={(v) => update({ icon: v })}
                />
                <ImageField
                  clinicId={clinicId}
                  hint="A small square illustration shown instead of the icon."
                  label="Illustration (optional)"
                  value={s.imageUrl}
                  onChange={(v) => update({ imageUrl: v })}
                />
              </>
            )}
            onChange={(items) => edit((d) => void (d.stats = items))}
          />
        </Section>

        {/* ── Services ── */}
        <Section
          description="Service cards and the “Explore” card"
          title="Services"
          {...sectionProps("services", "services")}
        >
          <Grid>
            <Field
              label="Small label"
              value={c.servicesSection.eyebrow}
              onChange={(v) =>
                edit((d) => void (d.servicesSection.eyebrow = v))
              }
            />
            <Field
              label="Heading"
              value={c.servicesSection.title}
              onChange={(v) => edit((d) => void (d.servicesSection.title = v))}
            />
          </Grid>
          <Field
            label="Description"
            multiline
            value={c.servicesSection.subtitle}
            onChange={(v) => edit((d) => void (d.servicesSection.subtitle = v))}
          />
          <Grid>
            <Field
              label="Top-right button text"
              value={c.servicesSection.buttonText}
              onChange={(v) =>
                edit((d) => void (d.servicesSection.buttonText = v))
              }
            />
            <Field
              label="Top-right button link"
              value={c.servicesSection.buttonLink}
              onChange={(v) =>
                edit((d) => void (d.servicesSection.buttonLink = v))
              }
            />
            <Field
              label="“Learn more” link text on each card"
              value={c.servicesSection.learnMoreText}
              onChange={(v) =>
                edit((d) => void (d.servicesSection.learnMoreText = v))
              }
            />
          </Grid>

          <SubHeading>Service cards</SubHeading>
          <ItemList
            addLabel="Add service"
            create={() => ({
              title: "",
              description: "",
              icon: "Sparkles",
              color: "text-rose-500",
              imageUrl: "",
              linkUrl: "/features",
            })}
            itemTitle={(s) => s.title}
            items={c.services}
            render={(s, update) => (
              <>
                <Field
                  label="Title"
                  value={s.title}
                  onChange={(v) => update({ title: v })}
                />
                <Field
                  label="Description"
                  multiline
                  value={s.description}
                  onChange={(v) => update({ description: v })}
                />
                <Grid>
                  <IconSelect
                    label="Icon"
                    value={s.icon}
                    onChange={(v) => update({ icon: v })}
                  />
                  <Field
                    label="“Learn more” link"
                    value={s.linkUrl}
                    onChange={(v) => update({ linkUrl: v })}
                  />
                </Grid>
                <ImageField
                  clinicId={clinicId}
                  label="Image"
                  value={s.imageUrl}
                  onChange={(v) => update({ imageUrl: v })}
                />
              </>
            )}
            onChange={(items) => edit((d) => void (d.services = items))}
          />

          <SubHeading>“Explore” card (last card)</SubHeading>
          <Grid>
            <Field
              label="Title"
              value={c.servicesSection.exploreTitle}
              onChange={(v) =>
                edit((d) => void (d.servicesSection.exploreTitle = v))
              }
            />
            <Field
              label="Button text"
              value={c.servicesSection.exploreButtonText}
              onChange={(v) =>
                edit((d) => void (d.servicesSection.exploreButtonText = v))
              }
            />
            <Field
              label="Button link"
              value={c.servicesSection.exploreButtonLink}
              onChange={(v) =>
                edit((d) => void (d.servicesSection.exploreButtonLink = v))
              }
            />
          </Grid>
          <Field
            label="Text"
            multiline
            value={c.servicesSection.exploreText}
            onChange={(v) =>
              edit((d) => void (d.servicesSection.exploreText = v))
            }
          />
        </Section>

        {/* ── Why choose us ── */}
        <Section
          description="“Science meets artistry” band with four reasons"
          title="Why choose us"
          {...sectionProps("whyChoose", "whyChoose")}
        >
          <Field
            label="Small label"
            value={c.whyChoose.eyebrow}
            onChange={(v) => edit((d) => void (d.whyChoose.eyebrow = v))}
          />
          <Grid>
            <Field
              label="Heading"
              value={c.whyChoose.title}
              onChange={(v) => edit((d) => void (d.whyChoose.title = v))}
            />
            <Field
              hint="Shown on the next line in italic brand colour."
              label="Highlighted word(s)"
              value={c.whyChoose.accent}
              onChange={(v) => edit((d) => void (d.whyChoose.accent = v))}
            />
          </Grid>
          <Field
            label="Paragraph"
            multiline
            value={c.whyChoose.description}
            onChange={(v) => edit((d) => void (d.whyChoose.description = v))}
          />
          <Grid>
            <Field
              label="Button text"
              value={c.whyChoose.buttonText}
              onChange={(v) => edit((d) => void (d.whyChoose.buttonText = v))}
            />
            <Field
              label="Button link"
              value={c.whyChoose.buttonLink}
              onChange={(v) => edit((d) => void (d.whyChoose.buttonLink = v))}
            />
          </Grid>
          <ImageField
            clinicId={clinicId}
            label="Photo"
            value={c.whyChoose.imageUrl}
            onChange={(v) => edit((d) => void (d.whyChoose.imageUrl = v))}
          />
          <Field
            hint="Handwritten note on the photo. Press Enter for a new line; leave empty to hide."
            label="Handwritten note"
            multiline
            rows={2}
            value={c.whyChoose.note}
            onChange={(v) => edit((d) => void (d.whyChoose.note = v))}
          />
          <SubHeading>Reasons</SubHeading>
          <ItemList
            addLabel="Add reason"
            create={() => ({ icon: "Star", title: "", desc: "" })}
            itemTitle={(f) => f.title}
            items={c.whyChoose.features}
            max={4}
            render={(f, update) => (
              <>
                <Grid>
                  <Field
                    label="Title"
                    value={f.title}
                    onChange={(v) => update({ title: v })}
                  />
                  <IconSelect
                    label="Icon"
                    value={f.icon}
                    onChange={(v) => update({ icon: v })}
                  />
                </Grid>
                <Field
                  label="Description"
                  value={f.desc}
                  onChange={(v) => update({ desc: v })}
                />
              </>
            )}
            onChange={(items) =>
              edit((d) => void (d.whyChoose.features = items))
            }
          />
        </Section>

        {/* ── Promo ── */}
        <Section
          description="The offer banner"
          title="Promotion banner"
          {...sectionProps("promo", "promo")}
        >
          <Grid>
            <Field
              label="Badge"
              value={c.promo.badge}
              onChange={(v) => edit((d) => void (d.promo.badge = v))}
            />
            <Field
              label="Title"
              value={c.promo.title}
              onChange={(v) => edit((d) => void (d.promo.title = v))}
            />
          </Grid>
          <Field
            label="Description"
            multiline
            value={c.promo.description}
            onChange={(v) => edit((d) => void (d.promo.description = v))}
          />
          <Grid>
            <Field
              label="Button text"
              value={c.promo.buttonText}
              onChange={(v) => edit((d) => void (d.promo.buttonText = v))}
            />
            <Field
              label="Button link"
              value={c.promo.buttonLink}
              onChange={(v) => edit((d) => void (d.promo.buttonLink = v))}
            />
          </Grid>
          <ImageField
            clinicId={clinicId}
            label="Background image"
            value={c.promo.imageUrl}
            onChange={(v) => edit((d) => void (d.promo.imageUrl = v))}
          />
        </Section>

        {/* ── Process ── */}
        <Section
          description="The treatment journey steps"
          title="Process"
          {...sectionProps("process", "process")}
        >
          <Grid>
            <Field
              label="Small label"
              value={c.processSection.eyebrow}
              onChange={(v) => edit((d) => void (d.processSection.eyebrow = v))}
            />
            <Field
              label="Heading"
              value={c.processSection.title}
              onChange={(v) => edit((d) => void (d.processSection.title = v))}
            />
          </Grid>
          <Field
            label="Description"
            multiline
            value={c.processSection.subtitle}
            onChange={(v) => edit((d) => void (d.processSection.subtitle = v))}
          />
          <SubHeading>Steps</SubHeading>
          <ItemList
            addLabel="Add step"
            create={() => ({
              step: String(c.process.length + 1).padStart(2, "0"),
              title: "",
              desc: "",
              imageUrl: "",
            })}
            itemTitle={(s) => `${s.step} ${s.title}`.trim()}
            items={c.process}
            render={(s, update) => (
              <>
                <Grid>
                  <Field
                    label="Step number"
                    value={s.step}
                    onChange={(v) => update({ step: v })}
                  />
                  <Field
                    label="Title"
                    value={s.title}
                    onChange={(v) => update({ title: v })}
                  />
                </Grid>
                <Field
                  label="Description"
                  multiline
                  value={s.desc}
                  onChange={(v) => update({ desc: v })}
                />
                <ImageField
                  clinicId={clinicId}
                  label="Image"
                  value={s.imageUrl}
                  onChange={(v) => update({ imageUrl: v })}
                />
              </>
            )}
            onChange={(items) => edit((d) => void (d.process = items))}
          />
        </Section>

        {/* ── Precision ── */}
        <Section
          description="Technology section with a check-list"
          title="Technology & precision"
          {...sectionProps("precision", "precision")}
        >
          <Grid>
            <Field
              label="Small label"
              value={c.precisionSection.eyebrow}
              onChange={(v) =>
                edit((d) => void (d.precisionSection.eyebrow = v))
              }
            />
            <Field
              label="Heading"
              value={c.precisionSection.title}
              onChange={(v) => edit((d) => void (d.precisionSection.title = v))}
            />
          </Grid>
          <Field
            label="Description"
            multiline
            value={c.precisionSection.description}
            onChange={(v) =>
              edit((d) => void (d.precisionSection.description = v))
            }
          />
          <ImageField
            clinicId={clinicId}
            label="Image"
            value={c.precisionSection.imageUrl}
            onChange={(v) =>
              edit((d) => void (d.precisionSection.imageUrl = v))
            }
          />
          <SubHeading>Check-list</SubHeading>
          <ItemList
            addLabel="Add point"
            create={() => ({ title: "", desc: "" })}
            itemTitle={(p) => p.title}
            items={c.precisionSection.points}
            render={(p, update) => (
              <>
                <Field
                  label="Title"
                  value={p.title}
                  onChange={(v) => update({ title: v })}
                />
                <Field
                  label="Description"
                  value={p.desc}
                  onChange={(v) => update({ desc: v })}
                />
              </>
            )}
            onChange={(items) =>
              edit((d) => void (d.precisionSection.points = items))
            }
          />
        </Section>

        {/* ── Gallery ── */}
        <Section
          description="Before & after cases and result numbers"
          title="Before & after gallery"
          {...sectionProps("gallery", "gallery")}
        >
          <Grid>
            <Field
              label="Small label"
              value={c.gallerySection.eyebrow}
              onChange={(v) => edit((d) => void (d.gallerySection.eyebrow = v))}
            />
            <Field
              label="Heading"
              value={c.gallerySection.title}
              onChange={(v) => edit((d) => void (d.gallerySection.title = v))}
            />
          </Grid>
          <Field
            label="Description"
            multiline
            value={c.gallerySection.subtitle}
            onChange={(v) => edit((d) => void (d.gallerySection.subtitle = v))}
          />
          <Grid>
            <Field
              label="Button text"
              value={c.gallerySection.ctaText}
              onChange={(v) => edit((d) => void (d.gallerySection.ctaText = v))}
            />
            <Field
              label="Button link"
              value={c.gallerySection.ctaLink}
              onChange={(v) => edit((d) => void (d.gallerySection.ctaLink = v))}
            />
          </Grid>
          <SubHeading>Cases</SubHeading>
          <ItemList
            addLabel="Add case"
            create={() => ({
              tag: "",
              label: "",
              sessions: "",
              result: "",
              imageUrl: "",
            })}
            itemTitle={(x) => x.label}
            items={c.gallerySection.cases}
            render={(x, update) => (
              <>
                <Grid>
                  <Field
                    label="Name"
                    value={x.label}
                    onChange={(v) => update({ label: v })}
                  />
                  <Field
                    hint="Cases with the same category are grouped under one filter tab."
                    label="Category (filter tab)"
                    value={x.tag}
                    onChange={(v) => update({ tag: v })}
                  />
                  <Field
                    label="Sessions"
                    value={x.sessions}
                    onChange={(v) => update({ sessions: v })}
                  />
                  <Field
                    label="Result"
                    value={x.result}
                    onChange={(v) => update({ result: v })}
                  />
                </Grid>
                <ImageField
                  clinicId={clinicId}
                  hint="One image: the left half is “before”, the right half is “after”."
                  label="Before / after image"
                  value={x.imageUrl}
                  onChange={(v) => update({ imageUrl: v })}
                />
              </>
            )}
            onChange={(items) =>
              edit((d) => void (d.gallerySection.cases = items))
            }
          />
          <SubHeading>Result numbers</SubHeading>
          <ItemList
            addLabel="Add number"
            create={() => ({ value: "", label: "" })}
            itemTitle={(x) => `${x.value} ${x.label}`.trim()}
            items={c.gallerySection.stats}
            max={4}
            render={(x, update) => (
              <Grid>
                <Field
                  label="Value"
                  value={x.value}
                  onChange={(v) => update({ value: v })}
                />
                <Field
                  label="Label"
                  value={x.label}
                  onChange={(v) => update({ label: v })}
                />
              </Grid>
            )}
            onChange={(items) =>
              edit((d) => void (d.gallerySection.stats = items))
            }
          />
        </Section>

        {/* ── Testimonials ── */}
        <Section
          description="Patient reviews"
          title="Testimonials"
          {...sectionProps("testimonials", "testimonials")}
        >
          <Grid>
            <Field
              label="Small label"
              value={c.testimonialsSection.eyebrow}
              onChange={(v) =>
                edit((d) => void (d.testimonialsSection.eyebrow = v))
              }
            />
            <Field
              label="Heading"
              value={c.testimonialsSection.title}
              onChange={(v) =>
                edit((d) => void (d.testimonialsSection.title = v))
              }
            />
          </Grid>
          <Field
            label="Description"
            value={c.testimonialsSection.subtitle}
            onChange={(v) =>
              edit((d) => void (d.testimonialsSection.subtitle = v))
            }
          />
          <SubHeading>Reviews</SubHeading>
          <ItemList
            addLabel="Add review"
            create={() => ({
              name: "",
              role: "Patient",
              text: "",
              imageUrl: "",
              rating: 5,
            })}
            itemTitle={(t) => t.name}
            items={c.testimonialsSection.items}
            render={(t, update) => (
              <>
                <Grid>
                  <Field
                    label="Name"
                    value={t.name}
                    onChange={(v) => update({ name: v })}
                  />
                  <Field
                    label="Role"
                    value={t.role}
                    onChange={(v) => update({ role: v })}
                  />
                </Grid>
                <Field
                  label="Review"
                  multiline
                  value={t.text}
                  onChange={(v) => update({ text: v })}
                />
                <ImageField
                  clinicId={clinicId}
                  label="Photo"
                  value={t.imageUrl}
                  onChange={(v) => update({ imageUrl: v })}
                />
              </>
            )}
            onChange={(items) =>
              edit((d) => void (d.testimonialsSection.items = items))
            }
          />
        </Section>

        {/* ── Team ── */}
        <Section
          description="Doctors and staff profiles"
          title="Meet the team"
          {...sectionProps("team", "team")}
        >
          <Grid>
            <Field
              label="Small label"
              value={c.teamSection.eyebrow}
              onChange={(v) => edit((d) => void (d.teamSection.eyebrow = v))}
            />
            <Field
              label="Heading"
              value={c.teamSection.title}
              onChange={(v) => edit((d) => void (d.teamSection.title = v))}
            />
          </Grid>
          <Field
            label="Description"
            multiline
            rows={2}
            value={c.teamSection.subtitle}
            onChange={(v) => edit((d) => void (d.teamSection.subtitle = v))}
          />
          <SubHeading>Team members</SubHeading>
          <ItemList
            addLabel="Add team member"
            create={() => ({
              name: "",
              title: "",
              imageUrl: "",
              badge: "Specialist",
              bio: "",
              specializations: [],
              credentials: [],
            })}
            itemTitle={(m) => m.name}
            items={c.teamSection.members}
            render={(m, update) => (
              <>
                <Grid>
                  <Field
                    label="Name"
                    value={m.name}
                    onChange={(v) => update({ name: v })}
                  />
                  <Field
                    label="Job title"
                    value={m.title}
                    onChange={(v) => update({ title: v })}
                  />
                </Grid>
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-medium text-text-main">
                    Badge colour
                  </p>
                  <select
                    aria-label="Badge colour"
                    className="h-10 rounded border border-border-base bg-surface px-2 text-xs text-text-main focus:outline-none focus:border-primary"
                    value={m.badge}
                    onChange={(e) => update({ badge: e.target.value })}
                  >
                    {["Founder", "Specialist", "Nurse"].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    {!["Founder", "Specialist", "Nurse"].includes(m.badge) && (
                      <option value={m.badge}>{m.badge}</option>
                    )}
                  </select>
                </div>
                <Field
                  label="Biography"
                  multiline
                  rows={4}
                  value={m.bio}
                  onChange={(v) => update({ bio: v })}
                />
                <ImageField
                  clinicId={clinicId}
                  label="Photo"
                  value={m.imageUrl}
                  onChange={(v) => update({ imageUrl: v })}
                />
                <StringList
                  addLabel="Add credential"
                  items={m.credentials}
                  label="Credentials"
                  onChange={(items) => update({ credentials: items })}
                />
                <StringList
                  addLabel="Add specialization"
                  items={m.specializations}
                  label="Specializations"
                  onChange={(items) => update({ specializations: items })}
                />
              </>
            )}
            onChange={(items) =>
              edit((d) => void (d.teamSection.members = items))
            }
          />
        </Section>

        {/* ── Contact ── */}
        <Section
          description="Address, hours, phone, email and map"
          title="Location & contact"
          {...sectionProps("contact", "contact")}
        >
          <Grid>
            <Field
              label="Small label"
              value={c.contact.eyebrow}
              onChange={(v) => edit((d) => void (d.contact.eyebrow = v))}
            />
            <Field
              label="Heading"
              value={c.contact.title}
              onChange={(v) => edit((d) => void (d.contact.title = v))}
            />
            <Field
              label="Address"
              value={c.contact.location}
              onChange={(v) => edit((d) => void (d.contact.location = v))}
            />
            <Field
              label="Opening hours"
              value={c.contact.hours}
              onChange={(v) => edit((d) => void (d.contact.hours = v))}
            />
            <Field
              label="Phone"
              value={c.contact.phone}
              onChange={(v) => edit((d) => void (d.contact.phone = v))}
            />
            <Field
              label="Email"
              value={c.contact.email}
              onChange={(v) => edit((d) => void (d.contact.email = v))}
            />
            <Field
              label="Map card title"
              value={c.contact.mapLabel}
              onChange={(v) => edit((d) => void (d.contact.mapLabel = v))}
            />
            <Field
              hint="Leave empty to search the address on Google Maps."
              label="“Get Directions” link"
              value={c.contact.directionsLink}
              onChange={(v) => edit((d) => void (d.contact.directionsLink = v))}
            />
          </Grid>
          <ImageField
            clinicId={clinicId}
            label="Map card background image"
            value={c.contact.mapImageUrl}
            onChange={(v) => edit((d) => void (d.contact.mapImageUrl = v))}
          />
        </Section>

        {/* ── CTA ── */}
        <Section
          description="The closing call-to-action"
          title="Call to action"
          {...sectionProps("cta", "cta")}
        >
          <Grid>
            <Field
              label="Small label"
              value={c.cta.eyebrow}
              onChange={(v) => edit((d) => void (d.cta.eyebrow = v))}
            />
            <Field
              label="Heading"
              value={c.cta.title}
              onChange={(v) => edit((d) => void (d.cta.title = v))}
            />
          </Grid>
          <Field
            label="Description"
            multiline
            value={c.cta.description}
            onChange={(v) => edit((d) => void (d.cta.description = v))}
          />
          <Grid>
            <Field
              label="Main button text"
              value={c.cta.primaryText}
              onChange={(v) => edit((d) => void (d.cta.primaryText = v))}
            />
            <Field
              label="Main button link"
              value={c.cta.primaryLink}
              onChange={(v) => edit((d) => void (d.cta.primaryLink = v))}
            />
            <Field
              label="Second button text"
              value={c.cta.secondaryText}
              onChange={(v) => edit((d) => void (d.cta.secondaryText = v))}
            />
            <Field
              label="Second button link"
              value={c.cta.secondaryLink}
              onChange={(v) => edit((d) => void (d.cta.secondaryLink = v))}
            />
          </Grid>
          <ImageField
            clinicId={clinicId}
            label="Background image"
            value={c.cta.imageUrl}
            onChange={(v) => edit((d) => void (d.cta.imageUrl = v))}
          />
        </Section>
      </div>

      <div className="flex justify-end gap-2 pb-6">
        <Button
          color="primary"
          isLoading={saving}
          startContent={<IoSaveOutline />}
          onClick={handleSave}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
