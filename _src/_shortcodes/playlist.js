const {html} = require('common-tags');

/**
 * A YouTube video embed.
 * @param {{id: string}} args
 * @return {string}
 */
const Playlist = args => {
  const {id} = args;

  if (!id) {
    throw new Error('No `id` provided to Playlist shortcode.');
  }

  const src = `https://www.youtube-nocookie.com/embed?listType=playlist&list=${id}&rel=0`;

  return html`
    <div class="youtube-playlist shadow mb-3 bg-body rounded">
      <div class="eleventy-plugin-youtube-embed" style="position:relative;width:100%;padding-top: 56.25%;">
        <iframe style="position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;" width="100%" height="100%"
                frameborder="0" title="Embedded YouTube video" src="${src}"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
    </div>
  `;
};

module.exports = {Playlist};
