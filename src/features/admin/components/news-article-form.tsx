"use client";

import { useState } from "react";

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
};

/**
 * Admin news article editor — plain `useState`, English-only chrome, shared by
 * the create and edit pages. The slug auto-suggests from the English title
 * (kebab-case) until the admin edits the slug field by hand, after which it is
 * left alone. Submitting posts to the passed server action.
 */
export function NewsArticleForm({ action, locale, initial, submitLabel }: NewsArticleFormProps) {
  const start = initial ?? EMPTY;
  const [values, setValues] = useState<NewsArticleFormValues>(start);
  // Once the admin touches the slug, stop auto-deriving it from the title.
  const [slugTouched, setSlugTouched] = useState(Boolean(start.slug));

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

  return (
    <form action={action} className="iv-editmodal__form">
      <input type="hidden" name="locale" value={locale} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

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
        <label className="iv-fieldlabel" htmlFor={`na-${bodyName}`}>
          Body (markdown)
        </label>
        <textarea
          id={`na-${bodyName}`}
          name={bodyName}
          className="iv-input"
          value={body}
          onChange={(e) => onBody(e.target.value)}
          rows={8}
          style={{ height: "auto", padding: "12px 14px", lineHeight: 1.5 }}
        />
      </div>
    </fieldset>
  );
}
