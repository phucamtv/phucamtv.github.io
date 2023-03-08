const { html } = require('common-tags');

const callout = (content) => {
    return html`
        <div class="alert alert-success" role="alert">
            ${content}
        </div>
    `;
};

module.exports = { callout };
