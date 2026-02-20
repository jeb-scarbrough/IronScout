import * as cheerio from 'cheerio'

export function loadHtml(payload: string): cheerio.CheerioAPI {
  return cheerio.load(payload)
}

export function firstText($: cheerio.CheerioAPI, selector: string): string {
  return $(selector).first().text().trim()
}

export function firstAttr(
  $: cheerio.CheerioAPI,
  selector: string,
  attr: string
): string | undefined {
  const value = $(selector).first().attr(attr)?.trim()
  return value || undefined
}
