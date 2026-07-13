"use client";

import { useRef, useState } from "react";

import { uploadNewsImage } from "@/features/admin/news-actions";
import { slugify } from "@/features/admin/news-slug";

export type NewsArticleFormValues = {
  id: string;
  slug: string;
  titlePl: string;
  titleEn: string;
  titleUa: string;
  bodyPl: string;
  bodyEn: string;
  bodyUa: string;
  coverImageUrl: string;
};

type NewsArticleFormProps = {
  /** The `createArticle` or `updateArticle` server action. */
  action: (formData: FormData) => void | Promise<void>;
  locale: string;
  /** Pre-filled values on edit; omit for a fresh create form. */
  initial?: NewsArticleFormValues;
  submitLabel: string;
};

const EMPTY: NewsArticleFormValues = {
  id: "",
  slug: "",
  titlePl: "",
  titleEn: "",
  titleUa: "",
  bodyPl: "",
  bodyEn: "",
  bodyUa: "",
  coverImageUrl: "",
};

/** Upload one image via the admin action; returns its Blob URL or throws a message. */
async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await uploadNewsImage(fd);
  if ("url" in res) return res.url;
  throw new Error(res.error);
}

/**
 * Admin news article editor — plain `useState`, English-only chrome, shared by
 * the create and edit pages. The slug auto-suggests from the English title
 * (kebab-case) until the admin edits the slug field by hand, after which it is
 * left alone. Images (cover + inline body photos) upload to Vercel Blob via the
 * `uploadNewsImage` action; the cover URL rides a hidden input and inline photos
 * are spliced into the body as `![](url)` at the cursor. Submitting posts to the
 * passed server action.
 */
export function NewsArticleForm({ action, locale, initial, submitLabel }: NewsArticleFormProps) {
  const start = initial ?? EMPTY;
  const [values, setValues] = useState<NewsArticleFormValues>(start);
  // Once the admin touches the slug, stop auto-deriving it from the title.
  const [slugTouched, setSlugTouched] = useState(Boolean(start.slug));

  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  function set<K extends keyof NewsArticleFormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onTitleEn(value: string) {
    setValues((prev) => ({
      ...prev,
      titleEn: value,
      slug: slugTouched ? prev.slug : slugify(value),
    }));
  }

  async function onCoverPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after a failure
    if (!file) return;
    setCoverError(null);
    setCoverBusy(true);
    try {
      set("coverImageUrl", await uploadImage(file));
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setCoverBusy(false);
    }
  }

  return (
    <form action={action} className="iv-editmodal__form">
      <input type="hidden" name="locale" value={locale} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="coverImageUrl" value={values.coverImageUrl} />

      <div>
        <label className="iv-fieldlabel" htmlFor="na-slug">
          Slug
        </label>
        <input
          id="na-slug"
          name="slug"
          className="iv-input"
          value={values.slug}
          onChange={(e) => {
            setSlugTouched(true);
            set("slug", e.target.value);
          }}
          placeholder="auto-suggested from the English title"
        />
        <p className="iv-note" style={{ marginTop: 4 }}>
          Used in the public URL. Auto-suggested from the English title; editable while the article
          is a draft.
        </p>
      </div>

      <div>
        <span className="iv-fieldlabel">Cover image</span>
        {values.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Blob URL preview, admin-only
          <img
            src={values.coverImageUrl}
            alt=""
            style={{
              display: "block",
              maxWidth: "100%",
              maxHeight: 220,
              borderRadius: 8,
              margin: "8px 0",
              border: "1px solid rgba(255,255,255,.12)",
            }}
          />
        ) : null}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          onChange={onCoverPicked}
          style={{ display: "none" }}
        />
        <div className="iv-inline" style={{ gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-stroke btn-sm"
            onClick={() => coverInputRef.current?.click()}
            disabled={coverBusy}
          >
            {coverBusy ? "Uploading…" : values.coverImageUrl ? "Replace cover" : "Upload cover"}
          </button>
          {values.coverImageUrl ? (
            <button
              type="button"
              className="btn btn-stroke btn-sm"
              onClick={() => set("coverImageUrl", "")}
              disabled={coverBusy}
            >
              Remove
            </button>
          ) : null}
        </div>
        {coverError ? (
          <p className="iv-note" style={{ marginTop: 6, color: "var(--acl-red)" }}>
            {coverError}
          </p>
        ) : null}
        <p className="iv-note" style={{ marginTop: 6 }}>
          Shown on the news cards, landing preview, and at the top of the article. Required to
          publish.
        </p>
      </div>

      <LocaleFields
        locale="English"
        titleName="titleEn"
        bodyName="bodyEn"
        title={values.titleEn}
        body={values.bodyEn}
        onTitle={onTitleEn}
        onBody={(v) => set("bodyEn", v)}
      />
      <LocaleFields
        locale="Polish"
        titleName="titlePl"
        bodyName="bodyPl"
        title={values.titlePl}
        body={values.bodyPl}
        onTitle={(v) => set("titlePl", v)}
        onBody={(v) => set("bodyPl", v)}
      />
      <LocaleFields
        locale="Ukrainian"
        titleName="titleUa"
        bodyName="bodyUa"
        title={values.titleUa}
        body={values.bodyUa}
        onTitle={(v) => set("titleUa", v)}
        onBody={(v) => set("bodyUa", v)}
      />

      <div className="iv-actions">
        <button type="submit" className="btn btn-red btn-sm">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function LocaleFields({
  locale,
  titleName,
  bodyName,
  title,
  body,
  onTitle,
  onBody,
}: {
  locale: string;
  titleName: string;
  bodyName: string;
  title: string;
  body: string;
  onTitle: (value: string) => void;
  onBody: (value: string) => void;
}) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const url = await uploadImage(file);
      const snippet = `![](${url})`;
      const el = bodyRef.current;
      // Splice the image markdown in at the cursor; fall back to appending.
      const start = el?.selectionStart ?? body.length;
      const end = el?.selectionEnd ?? body.length;
      onBody(`${body.slice(0, start)}${snippet}${body.slice(end)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset style={{ border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, padding: 14 }}>
      <legend className="iv-fieldlabel" style={{ padding: "0 6px" }}>
        {locale}
      </legend>
      <div>
        <label className="iv-fieldlabel" htmlFor={`na-${titleName}`}>
          Title
        </label>
        <input
          id={`na-${titleName}`}
          name={titleName}
          className="iv-input"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          maxLength={200}
        />
      </div>
      <div style={{ marginTop: 12 }}>
        <div
          className="iv-inline"
          style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10 }}
        >
          <label className="iv-fieldlabel" htmlFor={`na-${bodyName}`}>
            Body (markdown)
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onImagePicked}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className="btn btn-stroke btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Uploading…" : "Insert image"}
          </button>
        </div>
        <textarea
          id={`na-${bodyName}`}
          ref={bodyRef}
          name={bodyName}
          className="iv-input"
          value={body}
          onChange={(e) => onBody(e.target.value)}
          rows={8}
          style={{ height: "auto", padding: "12px 14px", lineHeight: 1.5, marginTop: 6 }}
        />
        {error ? (
          <p className="iv-note" style={{ marginTop: 6, color: "var(--acl-red)" }}>
            {error}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
