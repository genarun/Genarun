# Recusrive generative tree system

This system focusses on the assembly of complex generative pipelines mixing different models.

It can be used to generate data for complete websites and generative datasets.

This project has been created for research purpose.

# Roadmap

## Processing features

### Random picks in strings

To introduce a bit more variations between runs, we could add a special syntax in the string parser beyond variabel replacement. We could for example use a syntax for basic array picking like: "Write a joke about[cats | a lizard | me ]" .

### API calls

We NEED to call some external APIs. Get current weather or currently trending hackernews posts. Since we'll be using inherited data from other steps, we assume quality would greatly improve by using a lightweight text model to assemble the call properly (place the parameters in the right place). This could be done in 2 nodes, but to avoid repeating the API definition, we could possbily plan it in a single-step (ie. using a assembleCall instruction, as well as as the call function.

### Progressive RAG:

On top of providing a set of base documents, we could internalize a RAG process that re-inject selected texts that have been indexed. For less than 500 pages, we can include the entire content in the prompt. Selected node content could be classified (and retrieved) using a user-selected embeding model. For example, instruct-large could be useful to query the text, while CLIP could be useful to bridge information between text and images (ie. find the 3 still images from the video that most closely match "video title", find text-articles that might be related to a given photo)

### Human steps

Those kind of steps would REALLY slow down pipelines, but it opens up many possibilities for creative collaboration and validation. Technichally, we'd need to save the pipeline progress and publish the human request. It caneither to a pool service like mechanichal turk (ie. choose best of 4 images), or a simple embeded system that asks the pipeline owner audience (ie. ask what should the charachter do now in the next scene, via a poll published on twitch).

Communication could be facilitated with a unique webhook in the form of runs/runid/nodeid/hook. We could easily imagine a simple internal polling system where the node define the interaction type, response format, and webhook: {type: "multipleChoice", question: "Which of these values has been most important for your organization in Q4", "options": ["revenue", "surival", "creativity"], postUrl: https://ex.com/uns/runid/nodeid/humanresponse}

## Infra features

### Auth

Would be useful for a public access app. Right now the app expose API keys so its best not to publish it.

### Proxy or server-ran pipeline

Create a proxy to handle API calls in a server.
It'd make more sense to run pipeline on the server, and output progress as logs updated in realtime via websocket or supabase realtime subs. Or alternatively, force users to provide keys, either saved in localStorage, or in a user account, and used in the client.

### Run Storage & image CDN

Right now, trees are executed on client-side. The lib could also be run server-side, and saved to a DB along all it's log. It could really simplify using pipeline outputs.

## UI features

### Pipeline control

We can already run selected nodes, but it'd be great to enable/disable some node using checkboxes to test some processes. On the run pane, a play/pause/stop button would also help react quickly. Better visual logging would also help, not just console logs to track queue progress.

### View previous runs

This could be good to not only access previous outputs, but see how long each steps took ran, how many total jobs, etc. We could also infer some basic costs aproximation based on model used and all API calls performed.

### Tree builder

Right now, trees need to be build in JSON. It's great for developpers and to manipulate using LLMs (internal or external), but there are opportunities to explain the structure much better visually. We could think for example about a nodal system like ComfyUi or TouchDesigner.

## Publishing

### templates & custom site generation

The main generated artefact now is a big JSON object containing all the text (markdown articles, structured objects, images urls, etc). To add value to users, we could offer user some ways to organize and publish these outputs. For example, if a user select a basic generative-blog template that has a standard format, we could easily provide them with a frontend template that would feed in from a single JSON ressource.

Realistically, a blog pipeline would be more sophisticated, account for new articles generation, ensure that there isn't too much repetition (using RAG), and have some sort of multi-step planning (plan out all themes before doing on-demand write out).

The beauty of this modular system is precisely its flexibility, so it could be a bit limiting to force the use of custom templates. It could be a better approach to provide a machine-readable summary of the pipeline-output structure, and let a site-gen pipeline create the files required for a given project. This site gen pipeline would simply need the project goal (user input), data structure, tech used. In this way, I could generate a reference website about pet lizard care, and output a codebase to host it as an statically generated Astro blog template hosted on Vercel.

To retrieve and generate the entire codebase, the user could copy a single line of command line in the terminal. ex: npx genpipe --exec genpipe.com/user/123456

If we favour a more local workflow, we could instead output the entire bash or node script for the user to coypaste. For easier debugging and dependency management, I'd suggest letting users download the script and execute it locally. The Format of our init.js script would be a series of instructions that parse the site-gen output.

{ files: {
'src/copmponents/hi.vue' : '.... multiline component code'
'package.json' : 'package code with all dependencies and scripts within it'
},
commands:  
[ 'npm i',
'npm create astro@latest',
'git init'
]

}

To sandbox things properly, we have the init script only create files based on what's out big filesToCreate[] array.
Then let users npm i, npm run processRunData & npm run dev on their own, for example.

This sounds complicated, but a lot of site-generation complexity can be mitigated by standardising the stack and providing the model with limited scope (ie: just focus on the route structure, and individual components). We could for example start all project with a single base template code that import entire site data as JSON and components logics around it.

### git integration + hosting

This entire process sitegen can also be run on server side, in a worker, and we git commit all changes if it passes the build + tests. There are 3 hosting level, git, building and serving. The git repo hosting, users will likely want to change logo, and things like that in the repo directly. We could commit the code + static json data in a GIANT repo that contains all the sitegen-outputs in different folders, or on different branches. Users could easily EJECT by just cloning this branch, or downloading the folder.

Sites hosting: For users who eject, they could host everything directly on Vercel, perhaps with an extra pre-build step that ensure we download all the images from site-data-json to local folder, in order to let user edits them but also prevent bandwith abuse.

If we wish to host the sites ourselves, we could host the builds outputs on a subdomain (user-CNAMEable).
That option would be the shortest path for users to create and publish a full genAI website

### github auth

Not sure what would be the best way to integrate with github here. Could be a great place to run the pipelines and save the artefacts (ie. JSON file + run logs + all generate images in a folder with unique ids.)

Maybe every users have a a single repo with all their projects? Or one repo per project? This would allow for a simple build, according, we only have ONE sitegen output per project.
For data, it'd be a very convenient way to access and save the runs. We could even purge the old logs in the script when it runs.

Repo

- trees
  - data-tree1/config.json //rerun automatically on change=true, within top node.
  - data-tree1/2024-05-05_21-32-11/output.json
  - data-tree1/2024-05-05_21-32-11/assets/img-9234.png
  - data-tree1/2024-05-05_21-32-11/logs.json
  - data-tree1/latest/output.json - the latest folder is just a copy of the latest run. We delete old one and copy as-is the full folder for convenience
  - sitegen-tree.json
  - sitegen-tree/latest.json
- workflow/config
  - github actions to run tree that are modified on push
- scripts
  - runDatatree.js
  - runAndInitSiteGen.js - cant run if src exists and isn't empty...
- src

  - all generated files from base template + siteGen outputs

- readme.md
  - info about how to use the project, a mix of template + generated description

--

# names

genpipe.dev - avail
app too

- gentree - app

tree.run/dev/app - taken
gen.rub -raken

mix.run - taken

generun, app + dev avail.
gene.run - no
genepipe

sounds liek gential?
