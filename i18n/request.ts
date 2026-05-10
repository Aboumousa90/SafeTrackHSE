import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  const locale = "nl";
  return {
    locale,
    messages: (await import(`../public/locales/${locale}.json`)).default,
  };
});
