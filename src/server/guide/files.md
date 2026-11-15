# Files

A document can carry files beside its markdown, like a folder holding `index.md` and what it uses. Reference a file by its plain name:

- `![Daily bytes, October](chart.png)` shows the image in the text. PNG, JPEG, GIF, WebP and AVIF show; an SVG only downloads.
- `[the raw numbers](data.csv)` becomes a download button with the file's size.
- Every file also appears in a Files list after the text.

Names are letters, digits, spaces, dots, dashes and parentheses, up to 100 characters, without slashes. A file is at most 10 MB, and a document holds at most 100 MB of them.

Files go into the document's draft and reach readers when the draft is published, as part of the next version. Each version keeps the files it had, so an old version still shows its old chart.

1. Publish or update the markdown that references the files.
2. Attach each file:
   - `attach(id, name, content_base64)` for small files.
   - From a shell, for anything larger: `curl -T chart.png -H "authorization: Bearer <api key>" <evergarden>/api/v1/documents/<id>/files/chart.png`.
3. Call `publish_draft(id)`.

`detach(id, name)` removes a file in the draft. `read` lists a version's files in its first line.

Anyone who may read the document may download its files, and no one else. Attach nothing secret to a document you share.
