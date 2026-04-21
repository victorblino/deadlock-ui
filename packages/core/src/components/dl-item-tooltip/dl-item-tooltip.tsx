import { Component, Prop, h } from '@stencil/core';
import type { VNode } from '@stencil/core';
import { Item, ItemProperty, TooltipSection } from '../../types';
import { isPropertyVisible, getSlotColor } from '../../utils/format';
import { tooltipHeaderBg, tooltipBodyBg, soulIcon } from '../../utils/assets';
import { injectFonts } from '../../utils/fonts';

export interface ComponentItemInfo {
  name: string;
  image?: string;
}

interface SectionTiming {
  key: string;
  prop: ItemProperty;
}

@Component({
  tag: 'dl-item-tooltip',
  styleUrl: 'dl-item-tooltip.css',
  shadow: true,
})
export class DlItemTooltip {
  /** Item data to display in the tooltip. */
  @Prop() itemData?: Item;

  /** Resolved component items to display at the bottom of the tooltip. */
  @Prop() componentItemsData?: ComponentItemInfo[];

  /** Resolved parent items (items this item is a component of). */
  @Prop() parentItemsData?: ComponentItemInfo[];

  /** Override the item name displayed in the tooltip header. */
  @Prop() nameOverride?: string;

  connectedCallback() {
    injectFonts();
  }

  private static STATUS_EFFECT_LABELS: Record<string, { label: string; sublabel: string }> = {
    StatusEffectStun: { label: 'Stuns', sublabel: 'targets hit' },
    StatusEffectDisarmed: { label: 'Disarms', sublabel: 'targets hit' },
    StatusEffectEMP: { label: 'Silences', sublabel: 'targets hit' },
    StatusEffectInvisible: { label: 'Invisible', sublabel: 'targets hit' },
    StatusEffectInfiniteClip: { label: 'Infinite Clip', sublabel: '' },
  };

  private getFormattedParts(prop: ItemProperty) {
    const value = prop.value === null || prop.value === undefined ? '' : String(prop.value);
    const numericValue = Number.parseFloat(value);
    const sign = Number.isFinite(numericValue) && numericValue >= 0 ? '+' : '';
    const prefix = prop.prefix?.replace('{s:sign}', sign) ?? '';
    const postfix = prop.postfix ?? '';
    const trimmedPostfix = postfix.trim();
    const suffix = trimmedPostfix && value.endsWith(trimmedPostfix) ? '' : postfix;

    return { prefix, value, suffix };
  }

  private renderFormattedValue(prop: ItemProperty, shrinkPostfix = false): VNode {
    const { prefix, value, suffix } = this.getFormattedParts(prop);

    return (
      <span class={{ 'full-property-value': true, 'is-negative': prop.negative_attribute === true }}>
        {prefix && <span class="prefix-value">{prefix}</span>}
        <span class="property-value">{value}</span>
        {suffix && <span class={{ 'postfix-value': true, 'shrink': shrinkPostfix }}>{suffix}</span>}
      </span>
    );
  }

  private isTimingKey(key: string, prop?: ItemProperty | null): boolean {
    void prop;
    return key === 'AbilityCooldown'
      || key === 'ProcCooldown'
      || key === 'AbilityChargeUpTime'
      || key === 'AbilityCooldownBetweenCharge';
  }

  private renderImportantProp(key: string): VNode | null {
    const item = this.itemData;
    if (!item?.properties) return null;

    const prop = item.properties[key];

    if (!prop || !isPropertyVisible(prop)) {
      const statusEffect = DlItemTooltip.STATUS_EFFECT_LABELS[key];
      if (!statusEffect) return null;

      return (
        <div class="important-stat-box status-effect">
          <div class="important-stat-content">
            <div class="important-stat-value">{statusEffect.label}</div>
            {statusEffect.sublabel && <div class="important-stat-label">{statusEffect.sublabel}</div>}
          </div>
        </div>
      );
    }

    return (
      <div class={{ 'important-stat-box': true, [`prop_${prop.css_class ?? ''}`]: !!prop.css_class }}>
        <div class="important-stat-content">
          <div class={{ 'important-stat-icon-value': true, 'hide-important-stat-icon': !prop.icon }}>
            {prop.icon && <img class="important-stat-icon" src={prop.icon} alt="" />}
            <div class="important-stat-value">{this.renderFormattedValue(prop, true)}</div>
          </div>
          <div class="important-stat-labels">
            <div class="important-stat-type">{prop.label ?? key}</div>
            {(prop.conditional || prop.usage_flags?.includes('ConditionallyApplied')) && (
              <div class="important-stat-label">Conditional</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  private renderBlockProperty(key: string, elevated: boolean): VNode | null {
    const item = this.itemData;
    if (!item?.properties) return null;

    const prop = item.properties[key];
    if (!prop || !isPropertyVisible(prop)) return null;

    return (
      <div class="block-prop-item shrink-container">
        <span class="attribute-value">{this.renderFormattedValue(prop)}</span>
        <span class={{ 'attribute-name': true, 'elevated': elevated }}>{prop.label ?? key}</span>
      </div>
    );
  }

  private renderSectionContent(section: TooltipSection, excludedKeys = new Set<string>()) {
    const itemProperties = this.itemData?.properties;

    return section.section_attributes.map(attr => {
      const importantKeys = new Set(attr.important_properties ?? []);
      const isExcluded = (key: string) => excludedKeys.has(key) || this.isTimingKey(key, itemProperties?.[key]);

      const importantList = (attr.important_properties ?? []).filter(key => !isExcluded(key));
      const regularProps = [
        ...(attr.elevated_properties ?? []),
        ...(attr.properties ?? []),
      ].filter(key => !importantKeys.has(key) && !isExcluded(key));
      const elevatedSet = new Set(attr.elevated_properties ?? []);
      const importantNodes: VNode[] = [];
      const regularNodes: VNode[] = [];

      importantList.forEach(key => {
        const node = this.renderImportantProp(key);
        if (node) importantNodes.push(node);
      });

      regularProps.forEach(key => {
        const node = this.renderBlockProperty(key, elevatedSet.has(key));
        if (node) regularNodes.push(node);
      });

      const hasImportant = importantNodes.length > 0;
      const hasRegular = regularNodes.length > 0;
      const hasDescription = !!attr.loc_string;

      return (
        <div
          class={{
            'applied-attributes-container': true,
            'has-description': hasDescription,
            'has-important': hasImportant,
            'has-multiple-important': importantNodes.length >= 2,
            [`important-count-${importantNodes.length}`]: hasImportant,
            'no-applied-stats': !hasRegular,
          }}
        >
          {attr.loc_string && <div class="mod-info-label" innerHTML={attr.loc_string}></div>}

          {(hasImportant || hasRegular) && (
            <div
              class={{
                'stats-block': true,
                'stats-block-inline': importantNodes.length === 1 && hasRegular,
                'stats-block-stacked': importantNodes.length >= 2,
                'stats-block-no-important': !hasImportant,
              }}
            >
              {hasImportant && (
                <div class={{ 'important-stats-wrapper': true, [`count-${importantNodes.length}`]: true }}>
                  {importantNodes}
                </div>
              )}
              {hasRegular && (
                <div class="stats-block-props">
                  {regularNodes}
                </div>
              )}
              {!hasRegular && hasImportant && <div class="stats-block-props empty"></div>}
            </div>
          )}
        </div>
      );
    });
  }

  private findSectionTimings(section: TooltipSection): { cooldown?: SectionTiming; chargeUp?: SectionTiming } {
    const item = this.itemData;
    if (!item?.properties) return {};

    const props = item.properties;
    const timings: { cooldown?: SectionTiming; chargeUp?: SectionTiming } = {};

    const addTiming = (key: string) => {
      const prop = props[key];
      if (!prop || !isPropertyVisible(prop)) return;

      if (key === 'AbilityChargeUpTime' || key === 'AbilityCooldownBetweenCharge') {
        timings.chargeUp = { key, prop };
        return;
      }

      if (key === 'ProcCooldown' || key === 'AbilityCooldown') {
        if (!timings.cooldown || key === 'ProcCooldown') {
          timings.cooldown = { key, prop };
        }
      }
    };

    for (const attr of section.section_attributes) {
      [
        ...(attr.important_properties ?? []),
        ...(attr.elevated_properties ?? []),
        ...(attr.properties ?? []),
      ].forEach(addTiming);
    }

    if (!timings.cooldown && section.section_type === 'active') {
      addTiming('AbilityCooldown');
    }

    return timings;
  }

  private renderTimingPill(timing: SectionTiming, kind: 'cooldown' | 'charge-up'): VNode {
    const fallbackIcon = kind === 'cooldown' ? this.itemData?.properties?.['AbilityCooldown']?.icon : undefined;
    const icon = timing.prop.icon || fallbackIcon;

    return (
      <span class={{ 'ability-timing': true, [kind]: true }}>
        {icon && <img class="ability-timing-icon" src={icon} alt="" />}
        <span class="ability-timing-value">{this.renderFormattedValue(timing.prop, true)}</span>
      </span>
    );
  }

  private renderInnateSection(section: TooltipSection) {
    return (
      <div class="section innate-section">
        {this.renderSectionContent(section)}
      </div>
    );
  }

  private renderAbilitySection(section: TooltipSection) {
    const sectionType = section.section_type ?? 'passive';
    const timings = this.findSectionTimings(section);
    const excludedKeys = new Set<string>();

    if (timings.cooldown) excludedKeys.add(timings.cooldown.key);
    if (timings.chargeUp) excludedKeys.add(timings.chargeUp.key);

    return (
      <div class={{ 'section': true, 'ability-section': true, [`ability-type-${sectionType}`]: true }}>
        <div class={{ 'ability-type-label': true, [sectionType]: true }}>
          <span class="ability-type-text">{sectionType}</span>
          {(timings.cooldown || timings.chargeUp) && (
            <span class="ability-timing-group">
              {timings.cooldown && this.renderTimingPill(timings.cooldown, 'cooldown')}
              {timings.chargeUp && this.renderTimingPill(timings.chargeUp, 'charge-up')}
            </span>
          )}
        </div>
        {this.renderSectionContent(section, excludedKeys)}
      </div>
    );
  }

  private renderComponentGroup(label: string, items?: ComponentItemInfo[]): VNode | null {
    if (!items || items.length === 0) return null;

    return (
      <div class="component-items-section">
        <div class="component-items-label">{label}</div>
        <div class="component-items-grid">
          {items.map(item => (
            <div class="component-item">
              {item.image && <img class="component-item-icon" src={item.image} alt="" />}
              <span class="component-item-name">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  render() {
    const item = this.itemData;
    if (!item) return null;

    const slot = item.item_slot_type;
    const slotColor = getSlotColor(slot);
    const headerBg = tooltipHeaderBg(slot);
    const bodyBg = tooltipBodyBg(slot);
    const hasComponents = !!this.componentItemsData?.length;
    const hasParents = !!this.parentItemsData?.length;
    const sections = item.tooltip_sections ?? [];

    return (
      <div
        class={{
          'tooltip': true,
          [`${slot}-mod`]: true,
          'has-components': hasComponents || hasParents,
        }}
        style={{ '--slot-color': slotColor }}
      >
        <div class="tooltip-shadow">
          <div class="tooltip-main">
            <div class="header-container" style={{ backgroundImage: `url("${headerBg}")` }}>
              <div class="mod-name-container shrink-container">
                <div class="mod-name shrink">{this.nameOverride ?? item.name}</div>
                {item.cost != null && item.cost > 0 && (
                  <div class="mod-cost">
                    <img class="soul-icon" src={soulIcon()} alt="Souls" />
                    {String(item.cost)}
                  </div>
                )}
              </div>
            </div>

            <div class="properties-container" style={{ backgroundImage: `url("${bodyBg}")` }}>
              {sections.map(section => (
                section.section_type === 'innate'
                  ? this.renderInnateSection(section)
                  : this.renderAbilitySection(section)
              ))}
            </div>
          </div>

          {(hasComponents || hasParents) && (
            <div class="component-items-shell" style={{ backgroundImage: `url("${bodyBg}")` }}>
              {this.renderComponentGroup('Component:', this.componentItemsData)}
              {this.renderComponentGroup('Component of:', this.parentItemsData)}
            </div>
          )}
        </div>
      </div>
    );
  }
}
