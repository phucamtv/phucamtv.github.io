const { DateTime } = require("luxon");
const fs = require("fs");
const pluginRss = require("@11ty/eleventy-plugin-rss");
const pluginSyntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const pluginNavigation = require("@11ty/eleventy-navigation");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const pluginYoutube = require("eleventy-plugin-youtube-embed");

function _cnfDev(cnf) {
  // Customize Markdown library and settings:
  cnf.setLibrary(
    "md",
    markdownIt({ html: true, breaks: true, linkify: true })
      .use(markdownItAnchor, {
        permalink: markdownItAnchor.permalink.ariaHidden({
          placement: "after",
          class: "direct-link",
          symbol: "#",
          level: [1, 2, 3, 4],
        }),
        slugify: cnf.getFilter("slug")
      }));

  // Override Browsersync defaults (used only with --serve)
  cnf.setBrowserSyncConfig({
    callbacks: {
      ready: function (err, browserSync) {
        const content_404 = fs.readFileSync('_site/404.html');

        browserSync.addMiddleware("*", (req, res) => {
          // Provides the 404 content without redirect.
          res.writeHead(404, { "Content-Type": "text/html; charset=UTF-8" });
          res.write(content_404);
          res.end();
        });
      },
    },
    ui: false,
    ghostMode: false
  });
}

function _cnfAssets(cnf) {
  // Copy the `img` and `css` folders to the output
  cnf.addPassthroughCopy("img");
  cnf.addPassthroughCopy("css");

  cnf.setDataDeepMerge(true); // https://www.11ty.dev/docs/data-deep-merge/
  cnf.addLayoutAlias("post", "layouts/post.njk");
  cnf.addLayoutAlias("bootstrap", "layouts/bootstrap.njk");
}

module.exports = function (cnf) {
  cnf.addPlugin(pluginRss);
  cnf.addPlugin(pluginSyntaxHighlight);
  cnf.addPlugin(pluginNavigation);
  cnf.addPlugin(pluginYoutube, {
    allowAutoplay: false,
    lite: false,
    noCookie: true
  });

  _cnfDev(cnf);
  _cnfAssets(cnf);

  // Custom filters
  {
    const _filterTagList = (tags) => (tags || []).filter(tag => ["all", "nav", "post", "posts"].indexOf(tag) === -1);

    cnf.addFilter("readableDate", dt => DateTime.fromJSDate(dt, { zone: 'utc' }).toFormat("dd LLL yyyy"));
    cnf.addFilter('htmlDateString', (dt) => DateTime.fromJSDate(dt, { zone: 'utc' }).toFormat('yyyy-LL-dd'));
    cnf.addFilter("min", (...numbers) => Math.min.apply(null, numbers));

    // Get the first `n` elements of a collection.
    cnf.addFilter("head", (array, n) => {
      if ( ! Array.isArray(array) || array.length === 0) {
        return [];
      }

      return (n < 0) ? array.slice(n) : array.slice(0, n);
    });

    cnf.addFilter("filterTagList", _filterTagList);

    // Create an array of all tags
    cnf.addCollection("tagList", function (collection) {
      let set = new Set();

      collection
        .getAll()
        .forEach(item => (item.data.tags || [])
          .forEach(tag => set.add(tag)));

      return _filterTagList([...set]);
    });
  }

  return {
    templateFormats: ["md", "njk", "html", "liquid"],
    pathPrefix: "/",
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: false,
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
};
