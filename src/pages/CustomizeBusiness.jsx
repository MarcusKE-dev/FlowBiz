// src/pages/CustomizeBusiness.jsx
//
// "Customize your business" — everything about what FlowBiz OFFERS this
// business, in one owner-facing page, in plain words.
//
// WHY IT IS A PAGE AND NOT A SETTINGS SECTION. Settings answers "what are
// my details and who may do what". This answers "how should FlowBiz work
// for the business I already have". Those are different questions, and
// stacking the second inside the first was already crowding a page that
// also holds the shop name, the logo, permissions, receipts and data
// export. Settings now keeps one short row that points here.
//
// WHAT IS NOT ON THIS PAGE: the business type. It is chosen once, on the
// Setup screen, because it is the foundation everything below is derived
// FROM — the units the product form knows, the words on screen, the pages
// offered and the categories the business starts with. Swapping
// Electronics for Pharmacy after a year of trading is not a preference,
// it is a different business, and treating it as an ordinary switch left
// a shop one mis-click from a configuration that matched nothing it had
// recorded. The type is shown here, plainly, and is not editable; a
// genuine correction goes through a platform administrator, server-side,
// where it is permissioned and audited (see the Worker's
// POST /api/admin/businesses/:id/industry).
//
// THREE RULES THIS PAGE HOLDS TO.
//
//   Nothing here is authorisation. Every switch changes what is OFFERED.
//   Who may read or write anything is decided by Firebase Auth, the
//   Firestore rules and the Worker, on `businessId` and `role` alone, and
//   nothing an owner does on this page moves that by a millimetre.
//
//   Nothing here deletes. Turning something off hides records; it never
//   destroys them, and the page says so wherever an owner can switch
//   something off. Switching back shows everything again, untouched.
//
//   Nothing here is an internal name. An owner sees "Batches and expiry",
//   never `batches`; "Money today", never `moneyToday`.
//
// It costs ZERO extra Firestore reads. Every value on it comes from the
// businessSettings document SettingsContext already holds one shared
// listener on, and the profile table it is resolved against is static
// code. Writes are setDoc(merge) through raceWithTimeout, so every change
// on this page works offline exactly as changing the shop name does.

import { useMemo, useState } from 'react';
import { RotateCcw, ArrowUp, ArrowDown, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSettings } from '../contexts/SettingsContext';
import { useIndustry } from '../hooks/useIndustry';
import { getProfile } from '../industry/profiles';
import {
  ownerConfigurableCapabilities, resetOverridesPayload,
  OVERRIDABLE_TERMS, MAX_TERM_LENGTH,
} from '../industry/config';
import {
  categoryWritePayload, resetCategoriesPayload, categoryKey,
  MAX_CATEGORIES, MAX_CATEGORY_LENGTH,
} from '../industry/categories';
import {
  expenseCategoryWritePayload, resetExpenseCategoriesPayload, isReservedExpenseCategory,
  MAX_EXPENSE_CATEGORIES, MAX_EXPENSE_CATEGORY_LENGTH,
} from '../industry/expenseCategories';
import { getUnit, DEFAULT_UNIT } from '../industry/units';
import { arrangeableWidgets } from '../industry/dashboard';
import { generateTableNames, normalizeTableNames, MAX_TABLES } from '../utils/orders';
import { useCustomizeWrites } from '../components/customize/useCustomizeWrites';
import Toggle from '../components/customize/Toggle';
import FloorPlanEditor from '../components/customize/FloorPlanEditor';
import { floorPlanField } from '../domain/fnb/floor';
import { normalizeStations, normalizeCourses, MAX_STATIONS, MAX_COURSES } from '../domain/fnb/stations';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import Section from '../components/ui/Section';
import StatusPill from '../components/ui/StatusPill';
import FormField from '../components/ui/FormField';

/** A bordered row on the surface — the page's one repeating container. */
function Row({ children, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 rounded-panel border border-line bg-surface px-3 py-3 ${className}`}>
      {children}
    </div>
  );
}

/** The plain-words reassurance, wherever an owner can switch something off. */
function NothingIsDeleted({ children }) {
  return <p className="text-secondary text-ink-500">{children}</p>;
}

export default function CustomizeBusiness() {
  const { settings } = useSettings();
  const industry = useIndustry();
  const { write, busy } = useCustomizeWrites();

  const [resetOpen, setResetOpen] = useState(false);
  const [categoryResetOpen, setCategoryResetOpen] = useState(false);
  const [tableCount, setTableCount] = useState(8);
  const [tableText, setTableText] = useState(null);
  const [planDraft, setPlanDraft] = useState(null);
  const [stationText, setStationText] = useState(null);
  const [courseText, setCourseText] = useState(null);
  const [termDraft, setTermDraft] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [renaming, setRenaming] = useState(null);
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [expenseResetOpen, setExpenseResetOpen] = useState(false);

  const toggles = useMemo(() => ownerConfigurableCapabilities(industry), [industry]);
  const widgets = useMemo(() => arrangeableWidgets(industry), [industry]);

  // ── 1. Capabilities ───────────────────────────────────────────────

  const handleToggle = (key, next) =>
    write(
      { capabilityOverrides: { ...(industry.overrides || {}), [key]: next } },
      next ? 'Turned on' : 'Turned off'
    );

  // ── 2. Units ──────────────────────────────────────────────────────
  //
  // An owner chooses which of their trade's units the product form
  // offers. They cannot add a unit the profile does not have — that is a
  // change of trade, and the trade was settled when the business was
  // created.

  const chosenUnits = industry.units;
  const handleUnit = (unitId, next) => {
    const nextList = next
      ? [...chosenUnits, unitId]
      : chosenUnits.filter((id) => id !== unitId);
    // The default unit is never removable: every product that has never
    // been given a unit is a piece, so dropping it would leave existing
    // products showing a unit the form no longer offers.
    const ordered = industry.profileUnits.filter((id) => nextList.includes(id) || id === DEFAULT_UNIT);
    return write({ unitOverrides: ordered }, next ? 'Unit added' : 'Unit hidden');
  };

  // ── 3. Dashboard ──────────────────────────────────────────────────

  const shownWidgets = widgets.filter((w) => w.shown);

  const saveWidgets = (list, message) =>
    write({ dashboardOverrides: list.map((w) => w.id) }, message);

  const moveWidget = (index, delta) => {
    const next = [...shownWidgets];
    const target = index + delta;
    if (target < 0 || target >= next.length) return undefined;
    [next[index], next[target]] = [next[target], next[index]];
    return saveWidgets(next, 'Dashboard reordered');
  };

  const setWidgetShown = (widget, shown) => {
    if (!shown && shownWidgets.length <= 1) return undefined;
    const next = shown
      ? [...shownWidgets, widget]
      : shownWidgets.filter((w) => w.id !== widget.id);
    return saveWidgets(next, shown ? 'Added to your dashboard' : 'Hidden from your dashboard');
  };

  // ── 4. Words ──────────────────────────────────────────────────────

  const termValue = (key) => termDraft?.[key] ?? industry.terms[key] ?? '';
  const termsDirty = termDraft !== null;

  const handleSaveTerms = async () => {
    const next = {};
    for (const key of OVERRIDABLE_TERMS) {
      const typed = String(termValue(key) || '').trim();
      // A word set back to what the trade already calls it is not an
      // override — it is the default, and storing it would leave the page
      // claiming the business is customised when it is not.
      const profileDefault = { ...getProfile(industry.profileId).terms };
      if (!typed || typed === profileDefault[key]) continue;
      next[key] = typed.slice(0, MAX_TERM_LENGTH);
    }
    const ok = await write({ termOverrides: next }, 'Saved');
    if (ok) setTermDraft(null);
  };

  const handleResetTerms = async () => {
    const ok = await write({ termOverrides: {} }, 'Back to the usual words');
    if (ok) setTermDraft(null);
  };

  // ── 5. Tables ─────────────────────────────────────────────────────

  const savedTables = useMemo(() => normalizeTableNames(settings.tables), [settings.tables]);
  const tableValue = tableText ?? savedTables.join(', ');

  const handleSaveTables = async () => {
    const tables = normalizeTableNames(tableValue.split(','));
    const ok = await write({ tables }, tables.length === 0 ? 'Tables cleared' : `${tables.length} tables saved`);
    if (ok) setTableText(null);
  };

  // ── 5b. The floor plan ────────────────────────────────────────────
  //
  // Arrangement only, saved separately from the table names, because they
  // answer different questions and an owner renaming a table should not
  // have to re-place the room. `floorPlanField` clears the field entirely
  // when the plan is empty rather than storing `[]`.
  const handleSavePlan = async () => {
    const ok = await write(floorPlanField(planDraft), 'Floor plan saved');
    if (ok) setPlanDraft(null);
  };

  // ── 5c. Kitchen sections and courses ──────────────────────────────
  const handleSaveStations = async () => {
    const stations = normalizeStations(stationText.split(',').map((name) => ({ name })));
    const ok = await write(
      { stations: stations.length > 0 ? stations : null },
      stations.length === 0 ? 'Kitchen sections cleared' : `${stations.length} sections saved`
    );
    if (ok) setStationText(null);
  };

  const handleSaveCourses = async () => {
    const courses = normalizeCourses(courseText.split(',').map((name) => ({ name })));
    const ok = await write(
      { courses: courses.length > 0 ? courses : null },
      courses.length === 0 ? 'Courses cleared' : `${courses.length} courses saved`
    );
    if (ok) setCourseText(null);
  };

  // ── 6. Categories ─────────────────────────────────────────────────

  // The effective list — the trade's starting groups, minus the ones this
  // business took off, plus the words it added. Only the second half is
  // stored (see industry/categories.js), so every edit here writes the
  // DIFF against the trade rather than a frozen copy of the whole list.
  // That is what lets a business's own words survive a correction to its
  // business type, and what stopped a supermarket being shown a general
  // shop's categories.
  const categories = industry.categories;
  const customKeys = useMemo(
    () => new Set(industry.customCategories.map(categoryKey)),
    [industry.customCategories]
  );

  const saveCategories = (list, message) =>
    write(categoryWritePayload(list, industry.profileId), message);

  const handleAddCategory = async () => {
    const name = newCategory.replace(/\s+/g, ' ').trim().slice(0, MAX_CATEGORY_LENGTH);
    if (!name) return;
    if (categories.length >= MAX_CATEGORIES) return;
    if (categories.some((c) => categoryKey(c) === categoryKey(name))) {
      setNewCategory('');
      return;
    }
    const ok = await saveCategories([...categories, name], 'Category added');
    if (ok) setNewCategory('');
  };

  const handleRenameCategory = async () => {
    const name = String(renaming?.value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CATEGORY_LENGTH);
    if (!name || !renaming) return;
    // Renaming changes the word in the list. Products that point at the
    // OLD word keep pointing at it, which is why the old name is left in
    // place when anything still uses it — see the hint on the section.
    // Renaming one of the trade's own groups makes it this business's
    // word: the default is recorded as hidden and the new word as its
    // own, which is exactly what it now is.
    const ok = await saveCategories(
      categories.map((c) => (c === renaming.original ? name : c)),
      'Category renamed'
    );
    if (ok) setRenaming(null);
  };

  const moveCategory = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= categories.length) return undefined;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    return saveCategories(next, 'Categories reordered');
  };

  const removeCategory = (name) =>
    saveCategories(categories.filter((c) => c !== name), 'Category removed from the list');

  const handleResetCategories = async () => {
    const ok = await write(resetCategoriesPayload(), `Back to the categories for ${industry.label}`);
    if (ok) setCategoryResetOpen(false);
  };

  // ── 6b. Expense categories ────────────────────────────────────────
  //
  // Same diff-against-defaults model as the product categories above, so
  // adding a word here and correcting FlowBiz's own list later do not
  // fight. Nothing an owner does here touches an expense already
  // recorded: removing a word takes it off the list a NEW expense can be
  // filed under, and every expense already filed under it keeps its
  // category and is still counted by every report.

  const expenseCategories = industry.expenseCategories;

  const saveExpenseCategories = (list, message) =>
    write(expenseCategoryWritePayload(list), message);

  const handleAddExpenseCategory = async () => {
    const name = newExpenseCategory.replace(/\s+/g, ' ').trim().slice(0, MAX_EXPENSE_CATEGORY_LENGTH);
    if (!name) return;
    if (expenseCategories.length >= MAX_EXPENSE_CATEGORIES) return;
    // FlowBiz writes these two itself, for a purchase and a supplier
    // payment, and excludes them from Total Expenses so the money is not
    // counted twice. A hand-entered one would be silently ignored.
    if (isReservedExpenseCategory(name)) {
      toast.error(`FlowBiz records "${name}" for you when you pay a supplier.`);
      return;
    }
    if (expenseCategories.some((c) => categoryKey(c) === categoryKey(name))) {
      setNewExpenseCategory('');
      return;
    }
    const ok = await saveExpenseCategories([...expenseCategories, name], 'Category added');
    if (ok) setNewExpenseCategory('');
  };

  const removeExpenseCategory = (name) =>
    saveExpenseCategories(expenseCategories.filter((c) => c !== name), 'Category removed');

  const moveExpenseCategory = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= expenseCategories.length) return undefined;
    const next = [...expenseCategories];
    [next[index], next[target]] = [next[target], next[index]];
    return saveExpenseCategories(next, 'Reordered');
  };

  const handleResetExpenseCategories = async () => {
    const ok = await write(resetExpenseCategoriesPayload(), 'Back to the usual list');
    if (ok) setExpenseResetOpen(false);
  };

  // ── 7. Reset ──────────────────────────────────────────────────────

  const handleReset = async () => {
    const ok = await write(resetOverridesPayload(), `Back to the defaults for ${industry.label}`);
    if (ok) setResetOpen(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Customize your business"
        description="How FlowBiz works for your business. Nothing here changes what you have recorded."
        actions={
          !industry.usesDefaults && (
            <button type="button" className="btn-secondary" onClick={() => setResetOpen(true)} disabled={busy}>
              <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Reset
            </button>
          )
        }
      />

      {/* ── Your trade ───────────────────────────────────────────── */}
      <Section
        title="Your business type"
        hint="Chosen when this business was created. Everything below starts from it."
      >
        <Row>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-body font-medium text-ink-900">{industry.label}</p>
              <StatusPill tone={industry.usesDefaults ? 'neutral' : 'caution'}>
                {industry.usesDefaults ? 'Using defaults' : 'Customised'}
              </StatusPill>
            </div>
            <p className="text-secondary text-ink-500">{industry.tagline}</p>
          </div>
        </Row>
        <NothingIsDeleted>
          Set up wrongly? Contact FlowBiz support and we will correct it.
        </NothingIsDeleted>
      </Section>

      {/* ── 1. Capabilities ──────────────────────────────────────── */}
      {toggles.length > 0 && (
        <Section
          title="What FlowBiz shows you"
          hint="Turn off anything you do not use. Hiding something never deletes it."
        >
          <div className="space-y-2">
            {toggles.map((capability) => (
              <Row key={capability.key}>
                <div className="min-w-0">
                  <p id={`cap-${capability.key}`} className="text-body font-medium text-ink-900">
                    {capability.label}
                    {!capability.isDefault && (
                      <span className="ml-2 text-label uppercase text-ink-400">changed</span>
                    )}
                  </p>
                  <p className="text-secondary text-ink-500">{capability.description}</p>
                </div>
                <Toggle
                  checked={capability.enabled}
                  onChange={(next) => handleToggle(capability.key, next)}
                  disabled={busy}
                  labelledBy={`cap-${capability.key}`}
                />
              </Row>
            ))}
          </div>
        </Section>
      )}

      {/* ── 2. Units ─────────────────────────────────────────────── */}
      {industry.can('units') && industry.profileUnits.length > 1 && (
        <Section
          title="Units"
          hint="Which units the product form offers."
        >
          <div className="space-y-2">
            {industry.profileUnits.map((unitId) => {
              const unit = getUnit(unitId);
              const isDefault = unitId === DEFAULT_UNIT;
              return (
                <Row key={unitId}>
                  <div className="min-w-0">
                    <p id={`unit-${unitId}`} className="text-body font-medium text-ink-900">
                      {unit.label} <span className="font-normal text-ink-400">({unit.short})</span>
                    </p>
                    {isDefault && (
                      <p className="text-secondary text-ink-500">Always offered.</p>
                    )}
                  </div>
                  <Toggle
                    checked={chosenUnits.includes(unitId)}
                    onChange={(next) => handleUnit(unitId, next)}
                    disabled={busy || isDefault}
                    labelledBy={`unit-${unitId}`}
                  />
                </Row>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── 3. Dashboard ─────────────────────────────────────────── */}
      <Section
        title="Dashboard"
        hint="What you see when you open FlowBiz, and in what order."
      >
        <div className="space-y-2">
          {shownWidgets.map((widget, index) => (
            <Row key={widget.id}>
              <div className="min-w-0">
                <p className="text-body font-medium text-ink-900">{widget.label}</p>
                <p className="text-secondary text-ink-500">{widget.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="btn-ghost !px-2 text-ink-600"
                  onClick={() => moveWidget(index, -1)}
                  disabled={busy || index === 0}
                  aria-label={`Move ${widget.label} up`}
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn-ghost !px-2 text-ink-600"
                  onClick={() => moveWidget(index, 1)}
                  disabled={busy || index === shownWidgets.length - 1}
                  aria-label={`Move ${widget.label} down`}
                >
                  <ArrowDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn-ghost !px-2 text-ink-600 disabled:opacity-40"
                  onClick={() => setWidgetShown(widget, false)}
                  disabled={busy || shownWidgets.length <= 1}
                  aria-label={`Hide ${widget.label}`}
                >
                  <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </Row>
          ))}

          {widgets.some((w) => !w.shown) && (
            <div className="space-y-2 pt-1">
              <p className="text-label uppercase text-ink-400">Hidden</p>
              {widgets.filter((w) => !w.shown).map((widget) => (
                <Row key={widget.id}>
                  <div className="min-w-0">
                    <p className="text-body font-medium text-ink-600">{widget.label}</p>
                    <p className="text-secondary text-ink-500">{widget.description}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary shrink-0"
                    onClick={() => setWidgetShown(widget, true)}
                    disabled={busy}
                  >
                    <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    Show
                  </button>
                </Row>
              ))}
            </div>
          )}
          <NothingIsDeleted>
            Hiding a panel changes nothing behind it. Every report still counts the same figures.
          </NothingIsDeleted>
        </div>
      </Section>

      {/* ── 4. Words ─────────────────────────────────────────────── */}
      <Section
        title="Words"
        hint="What FlowBiz calls the things you sell. Leave a box blank for the usual word."
      >
        <div className="space-y-3 rounded-panel border border-line bg-surface p-3">
          <FormField label="The page is called" htmlFor="term-catalogue">
            <input
              id="term-catalogue"
              className="input"
              maxLength={MAX_TERM_LENGTH}
              value={termValue('catalogue')}
              onChange={(e) => setTermDraft((d) => ({ ...(d || {}), catalogue: e.target.value }))}
              disabled={busy}
              placeholder={getProfile(industry.profileId).terms.catalogue || 'Products'}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="One of them is a" htmlFor="term-item">
              <input
                id="term-item"
                className="input"
                maxLength={MAX_TERM_LENGTH}
                value={termValue('catalogueItem')}
                onChange={(e) => setTermDraft((d) => ({ ...(d || {}), catalogueItem: e.target.value }))}
                disabled={busy}
                placeholder="product"
              />
            </FormField>
            <FormField label="Several of them are" htmlFor="term-items">
              <input
                id="term-items"
                className="input"
                maxLength={MAX_TERM_LENGTH}
                value={termValue('catalogueItemPlural')}
                onChange={(e) => setTermDraft((d) => ({ ...(d || {}), catalogueItemPlural: e.target.value }))}
                disabled={busy}
                placeholder="products"
              />
            </FormField>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-divider pt-3">
            {Object.keys(industry.termOverrides).length > 0 && (
              <button type="button" className="btn-ghost !px-2 text-ink-600" onClick={handleResetTerms} disabled={busy}>
                Use the usual words
              </button>
            )}
            <button type="button" className="btn-primary" onClick={handleSaveTerms} disabled={busy || !termsDirty}>
              {busy ? 'Saving…' : 'Save words'}
            </button>
          </div>
        </div>
      </Section>

      {/* ── 5. Tables ────────────────────────────────────────────── */}
      {industry.can('tables') && (
        <Section
          title="Tables"
          hint="A table shows as taken while an order is open on it."
        >
          <div className="space-y-2 rounded-panel border border-line bg-surface p-3">
            <FormField label="Table names" hint="Separated by commas." htmlFor="table-names">
              <textarea
                id="table-names"
                className="input !min-h-[68px]"
                rows={2}
                value={tableValue}
                onChange={(e) => setTableText(e.target.value)}
                placeholder="Table 1, Table 2, Table 3"
                disabled={busy}
              />
            </FormField>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min="1"
                max={MAX_TABLES}
                className="input num !w-20"
                value={tableCount}
                onChange={(e) => setTableCount(e.target.value)}
                disabled={busy}
                aria-label="How many tables to generate"
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setTableText(generateTableNames(tableCount).join(', '))}
                disabled={busy}
              >
                Number them for me
              </button>
              <button
                type="button"
                className="btn-primary ml-auto"
                onClick={handleSaveTables}
                disabled={busy || tableText === null}
              >
                Save tables
              </button>
            </div>
          </div>

          {/* ── The floor plan ───────────────────────────────────────
              Optional, and additive: it arranges the names saved above.
              A business that never touches it keeps a plain list of
              tables and every screen still works — the floor view and
              the customer display lay unarranged tables out in reading
              order. See domain/fnb/floor.js. */}
          <div className="mt-3 space-y-3 rounded-panel border border-line bg-surface p-3">
            <div>
              <p className="text-body font-semibold text-ink-900">Floor plan</p>
              <p className="text-secondary text-ink-500">
                Where each table sits, for the floor screen and the customer display. Optional:
                without it, tables are laid out in the order you named them.
              </p>
            </div>

            <FloorPlanEditor
              tableNames={tableValue.split(',').map((t) => t.trim()).filter(Boolean)}
              plan={planDraft ?? settings.floorPlan}
              onChange={setPlanDraft}
              disabled={busy}
            />

            <div className="flex justify-end border-t border-divider pt-3">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSavePlan}
                disabled={busy || planDraft === null}
              >
                {busy ? 'Saving…' : 'Save floor plan'}
              </button>
            </div>
          </div>
        </Section>
      )}

      {/* ── 5b. Kitchen sections ─────────────────────────────────────
          Where an item is made. One rail per section on the kitchen
          screen, and a product points at one from its own form. */}
      {industry.can('kitchenStations') && (
        <Section
          title="Kitchen sections"
          hint="Each section gets its own rail on the kitchen screen. Anything not routed lands on the main one."
        >
          <div className="space-y-2 rounded-panel border border-line bg-surface p-3">
            <FormField
              label="Section names"
              hint={`Separated by commas. Up to ${MAX_STATIONS}.`}
              htmlFor="station-names"
            >
              <textarea
                id="station-names"
                className="input !min-h-[68px]"
                rows={2}
                value={stationText ?? normalizeStations(settings.stations).map((s) => s.name).join(', ')}
                onChange={(e) => setStationText(e.target.value)}
                placeholder="Grill, Cold section, Bar, Pastry"
                disabled={busy}
              />
            </FormField>
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveStations}
                disabled={busy || stationText === null}
              >
                Save sections
              </button>
            </div>
          </div>
        </Section>
      )}

      {/* ── 5c. Courses ──────────────────────────────────────────────
          WHEN something is served, as opposed to where it is made. */}
      {industry.can('courses') && (
        <Section
          title="Courses"
          hint="Pace a table: starters go to the kitchen now, mains when the floor says so."
        >
          <div className="space-y-2 rounded-panel border border-line bg-surface p-3">
            <FormField
              label="Course names"
              hint={`In the order they are served. Up to ${MAX_COURSES}.`}
              htmlFor="course-names"
            >
              <textarea
                id="course-names"
                className="input !min-h-[68px]"
                rows={2}
                value={courseText ?? normalizeCourses(settings.courses).map((c) => c.name).join(', ')}
                onChange={(e) => setCourseText(e.target.value)}
                placeholder="Starters, Mains, Dessert"
                disabled={busy}
              />
            </FormField>
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveCourses}
                disabled={busy || courseText === null}
              >
                Save courses
              </button>
            </div>
          </div>
        </Section>
      )}

      {/* ── 6. Categories ────────────────────────────────────────── */}
      <Section
        title="Categories"
        hint={
          industry.usesDefaultCategories
            ? `The groups FlowBiz suggests for ${industry.label}. Add, rename, reorder or remove any of them.`
            : `How your ${industry.terms.catalogueItemPlural} are grouped. The order here is the order they appear in.`
        }
        action={
          !industry.usesDefaultCategories && (
            <button
              type="button"
              className="btn-ghost !px-2 text-ink-600"
              onClick={() => setCategoryResetOpen(true)}
              disabled={busy}
            >
              Use suggested
            </button>
          )
        }
      >
        <div className="space-y-2">
          {categories.map((name, index) => (
            <Row key={name}>
              {renaming?.original === name ? (
                <>
                  <input
                    className="input"
                    value={renaming.value}
                    maxLength={MAX_CATEGORY_LENGTH}
                    onChange={(e) => setRenaming((r) => ({ ...r, value: e.target.value }))}
                    disabled={busy}
                    aria-label={`New name for ${name}`}
                    autoFocus
                  />
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" className="btn-secondary" onClick={() => setRenaming(null)} disabled={busy}>
                      Cancel
                    </button>
                    <button type="button" className="btn-primary" onClick={handleRenameCategory} disabled={busy}>
                      Save
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium text-ink-900">{name}</p>
                    {customKeys.has(categoryKey(name)) && (
                      <p className="text-label uppercase text-ink-400">Your own</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="btn-ghost !px-2 text-ink-600"
                      onClick={() => moveCategory(index, -1)}
                      disabled={busy || index === 0}
                      aria-label={`Move ${name} up`}
                    >
                      <ArrowUp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost !px-2 text-ink-600"
                      onClick={() => moveCategory(index, 1)}
                      disabled={busy || index === categories.length - 1}
                      aria-label={`Move ${name} down`}
                    >
                      <ArrowDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost !px-2 text-ink-600"
                      onClick={() => setRenaming({ original: name, value: name })}
                      disabled={busy}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn-ghost !px-2 text-ink-600"
                      onClick={() => removeCategory(name)}
                      disabled={busy || categories.length <= 1}
                      aria-label={`Remove ${name}`}
                    >
                      <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                </>
              )}
            </Row>
          ))}

          <div className="flex items-center gap-2">
            <input
              className="input"
              value={newCategory}
              maxLength={MAX_CATEGORY_LENGTH}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Add a category"
              disabled={busy || categories.length >= MAX_CATEGORIES}
              aria-label="New category name"
            />
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={handleAddCategory}
              disabled={busy || !newCategory.trim() || categories.length >= MAX_CATEGORIES}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Add
            </button>
          </div>
          <NothingIsDeleted>
            Anything already filed under a removed category keeps it. Your own categories stay yours.
          </NothingIsDeleted>
        </div>
      </Section>

      {/* ── 6b. Expense categories ───────────────────────────────── */}
      <Section
        title="Expense categories"
        hint="What the Expenses page offers when you record money spent."
        action={
          !industry.usesDefaultExpenseCategories && (
            <button
              type="button"
              className="btn-ghost !px-2 text-ink-600"
              onClick={() => setExpenseResetOpen(true)}
              disabled={busy}
            >
              Use suggested
            </button>
          )
        }
      >
        <div className="space-y-2">
          {expenseCategories.map((name, index) => (
            <Row key={name}>
              <p className="min-w-0 truncate text-body font-medium text-ink-900">{name}</p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="btn-ghost !px-2 text-ink-600"
                  onClick={() => moveExpenseCategory(index, -1)}
                  disabled={busy || index === 0}
                  aria-label={`Move ${name} up`}
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn-ghost !px-2 text-ink-600"
                  onClick={() => moveExpenseCategory(index, 1)}
                  disabled={busy || index === expenseCategories.length - 1}
                  aria-label={`Move ${name} down`}
                >
                  <ArrowDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn-ghost !px-2 text-ink-600"
                  onClick={() => removeExpenseCategory(name)}
                  disabled={busy || expenseCategories.length <= 1}
                  aria-label={`Remove ${name}`}
                >
                  <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </Row>
          ))}

          <div className="flex items-center gap-2">
            <input
              className="input"
              value={newExpenseCategory}
              maxLength={MAX_EXPENSE_CATEGORY_LENGTH}
              onChange={(e) => setNewExpenseCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddExpenseCategory(); } }}
              placeholder="Add a category"
              disabled={busy || expenseCategories.length >= MAX_EXPENSE_CATEGORIES}
              aria-label="New expense category name"
            />
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={handleAddExpenseCategory}
              disabled={busy || !newExpenseCategory.trim() || expenseCategories.length >= MAX_EXPENSE_CATEGORIES}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Add
            </button>
          </div>
          <NothingIsDeleted>
            Expenses already recorded keep their category and are still counted.
          </NothingIsDeleted>
        </div>
      </Section>

      {/* ── 7. Reset ─────────────────────────────────────────────── */}
      <Section
        title="Start again"
        hint={`Put the switches, units, dashboard and words back to what FlowBiz suggests for ${industry.label}. Categories have their own reset.`}
      >
        <Row>
          <NothingIsDeleted>
            Only the choices on this page are cleared. No product, sale, customer or figure is touched.
          </NothingIsDeleted>
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={() => setResetOpen(true)}
            disabled={busy || industry.usesDefaults}
          >
            Reset
          </button>
        </Row>
      </Section>

      <ConfirmDialog
        open={categoryResetOpen}
        title={`Use the suggested categories?`}
        message={`Your list goes back to the groups FlowBiz suggests for ${industry.label}. Any category you added is taken off the list. Products already filed under it keep it.`}
        confirmLabel={busy ? 'Resetting…' : 'Use suggested'}
        confirmDisabled={busy}
        onConfirm={handleResetCategories}
        onCancel={() => setCategoryResetOpen(false)}
      />

      <ConfirmDialog
        open={expenseResetOpen}
        title="Use the suggested expense categories?"
        message="Any category you added is taken off the list. Expenses already recorded keep theirs."
        confirmLabel={busy ? 'Resetting…' : 'Use suggested'}
        confirmDisabled={busy}
        onConfirm={handleResetExpenseCategories}
        onCancel={() => setExpenseResetOpen(false)}
      />

      <ConfirmDialog
        open={resetOpen}
        title="Back to the defaults?"
        message={`The switches, units, dashboard and words go back to what FlowBiz suggests for ${industry.label}. Your categories and records are left as they are.`}
        confirmLabel={busy ? 'Resetting…' : 'Reset'}
        confirmDisabled={busy}
        onConfirm={handleReset}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  );
}
