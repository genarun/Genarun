# Genarun - gena.run

**The glue for Generative AI m**

The Genarun system focuses on the assembly of complex generative pipelines mixing different models.

It can be used to generate data for complete websites and generative datasets.

This project has been created for research purposes in the context of building a a research-creation thesis where a photojournalism exhibition website is generated autonomously.

## Why

Genarun aim to offer a simple way to assemble different AI models together.

It uses a flexible tree specefication to output complex JSON response and asset folders.

For a broad range of GenAI projects, it replaces boilerplate code that orchestrate series of GenAi processes.

Using the hosted API for free (up to 100 minutes per month), or run the pipeline directly in your environement. It works in the browser, but if it's a public project, the local setup will risk exposing your underlying API keys for OpenAi or Replicate.

## Roadmap

This project is an early draft. The core functionalities are present, but there's lot that could be done to extend its potential.

### Processing Features

#### Adapters

We need to grow the number of supported adapters. Hugging face inference, Claude and more are comming. We are debating using Langchain or another lib to standardize interaction with these models. The json response flag is important for the text nodes, so we'll have to ensure all text providers supports it before rolling out a standardized adapter.

#### Local models

Simple JS models (ONNX) could be run locally, especially on fast hardware. It'll be great for custom-trained models or case where we need to transfer large data volume (not great for API). Custom models will only work with the local instance, not the web api, as Gena server needs a way to run all these models.

#### Random Picks in Strings

To introduce more variations between runs, we could add special syntax in the string parser beyond variable replacement. We could, for example, use syntax for basic array picking like: "Write a joke about [cats | a lizard | me]".

#### API Calls

We NEED to call some external APIs. Get current weather or currently trending Hacker News posts. Since we'll be using inherited data from other steps, we assume quality would greatly improve by using a lightweight text model to assemble the call properly (place the parameters in the right place). This could be done in 2 nodes, but to avoid repeating the API definition, we could possibly plan it in a single step (i.e., using an `assembleCall` instruction, as well as the call function).

#### Progressive RAG

On top of providing a set of base documents, we could internalize a RAG process that re-injects selected texts that have been indexed. For less than 500 pages, we can include the entire content in the prompt. Selected node content could be classified (and retrieved) using a user-selected embedding model. For example, instruct-large could be useful to query the text, while CLIP could be useful to bridge information between text and images (i.e., find the 3 still images from the video that most closely match "video title", find text articles that might be related to a given photo).

The step would need to provide the "promp template" for search, where we merge variables from previous steps, identify model and corpus used. To start, we can work externally with a RAG api that handles indexation and provides a user-friendly UI. We could use it to search a corpus of PDF documents. The RAG outputs a big txt summary that can be used as Suffix in later prompts, where relevant. It can be ran in paralell of other process to speed things up.

#### Human Steps

Those kinds of steps would REALLY slow down pipelines, but it opens up many possibilities for creative collaboration and validation. Technically, we'd need to save the pipeline progress and publish the human request. It can either go to a pool service like Mechanical Turk (i.e., choose best of 4 images), or a simple embedded system that asks the pipeline owner's audience (i.e., ask what should the character do now in the next scene, via a poll published on Twitch).

Communication could be facilitated with a unique webhook in the form of `runs/runid/nodeid/hook`. We could easily imagine a simple internal polling system where the node defines the interaction type, response format, and webhook:

```json
{
  "type": "multipleChoice",
  "question": "Which of these values has been most important for your organization in Q4",
  "options": ["revenue", "survival", "creativity"],
  "postUrl": "https://gena.run/runs/runid/nodeid/humanresponse"
}
```

### Infrastructure Features

#### Auth

Would be useful for a public access app. Right now the app exposes API keys so it's best not to publish it.

#### Proxy or Server-Run Pipeline

Create a proxy to handle API calls in a server.
It'd make more sense to run pipelines on the server, and output progress as logs updated in realtime via WebSocket or Supabase realtime subscriptions. Or alternatively, force users to provide keys, either saved in localStorage, or in a user account, and used in the client.

#### Run Storage & Image CDN

Right now, trees are executed on client-side. The lib could also be run server-side, and saved to a DB along with all its logs. It could really simplify using pipeline outputs.

### UI Features

#### Pipeline Control

We can already run selected nodes, but it'd be great to enable/disable some nodes using checkboxes to test some processes. On the run pane, a play/pause/stop button would also help react quickly. Better visual logging would also help, not just console logs to track queue progress.

#### View Previous Runs

This could be good to not only access previous outputs, but see how long each step took to run, how many total jobs, etc. We could also infer some basic cost approximation based on models used and all API calls performed.

#### Tree Builder

Right now, trees need to be built in JSON. It's great for developers and to manipulate using LLMs (internal or external), but there are opportunities to explain the structure much better visually. We could think for example about a nodal system like ComfyUI or TouchDesigner.

### Publishing

#### Templates & Custom Site Generation

The main generated artifact now is a big JSON object containing all the text (markdown articles, structured objects, images URLs, etc). To add value to users, we could offer users some ways to organize and publish these outputs. For example, if a user selects a basic generative-blog template that has a standard format, we could easily provide them with a frontend template that would feed in from a single JSON resource.

Realistically, a blog pipeline would be more sophisticated, account for new articles generation, ensure that there isn't too much repetition (using RAG), and have some sort of multi-step planning (plan out all themes before doing on-demand write out).

The beauty of this modular system is precisely its flexibility, so it could be a bit limiting to force the use of custom templates. It could be a better approach to provide a machine-readable summary of the pipeline-output structure, and let a site-gen pipeline create the files required for a given project. This site gen pipeline would simply need the project goal (user input), data structure, tech used. In this way, I could generate a reference website about pet lizard care, and output a codebase to host it as a statically generated Astro blog template hosted on Vercel.

To retrieve and generate the entire codebase, the user could copy a single line of command line in the terminal. ex: `npx genarun --exec gena.run/user/123456`

If we favor a more local workflow, we could instead output the entire bash or node script for the user to copy-paste. For easier debugging and dependency management, I'd suggest letting users download the script and execute it locally. The Format of our init.js script would be a series of instructions that parse the site-gen output:

```json
{
  "files": {
    "src/components/hi.vue": ".... multiline component code",
    "package.json": "package code with all dependencies and scripts within it"
  },
  "commands": ["npm i", "npm create astro@latest", "git init"]
}
```

To sandbox things properly, we have the init script only create files based on what's in our big `filesToCreate[]` array.
Then let users `npm i`, `npm run processRunData` & `npm run dev` on their own, for example.

This sounds complicated, but a lot of site-generation complexity can be mitigated by standardizing the stack and providing the model with limited scope (i.e., just focus on the route structure, and individual components). We could for example start all projects with a single base template code that imports entire site data as JSON and components logic around it.

#### Git Integration + Hosting

This entire process sitegen can also be run on server side, in a worker, and we git commit all changes if it passes the build + tests. There are 3 hosting levels: git, building and serving. For git repo hosting, users will likely want to change logo, and things like that in the repo directly. We could commit the code + static JSON data in a GIANT repo that contains all the sitegen-outputs in different folders, or on different branches. Users could easily EJECT by just cloning this branch, or downloading the folder.

Sites hosting: For users who eject, they could host everything directly on Vercel, perhaps with an extra pre-build step that ensures we download all the images from site-data-json to local folder, in order to let users edit them but also prevent bandwidth abuse.

If we wish to host the sites ourselves, we could host the builds outputs on a subdomain (user-CNAMEable).
That option would be the shortest path for users to create and publish a full genAI website.

#### GitHub Auth

Not sure what would be the best way to integrate with GitHub here. Could be a great place to run the pipelines and save the artifacts (i.e., JSON file + run logs + all generated images in a folder with unique ids.)

Maybe every user has a single repo with all their projects? Or one repo per project? This would allow for a simple build, accordingly, we only have ONE sitegen output per project.
For data, it'd be a very convenient way to access and save the runs. We could even purge the old logs in the script when it runs.

Repository structure:

```
Repository/
├── trees/
│   ├── data-tree1/
│   │   ├── config.json          // rerun automatically on change=true, within top node
│   │   ├── 2024-05-05_21-32-11/
│   │   │   ├── output.json
│   │   │   ├── assets/
│   │   │   │   └── img-9234.png
│   │   │   └── logs.json
│   │   └── latest/             // latest folder is just a copy of the latest run
│   │       └── output.json     // we delete old ones and copy as-is the full folder for convenience
│   ├── sitegen-tree.json
│   └── sitegen-tree/
│       └── latest.json
├── workflow/
│   └── config/                 // github actions to run tree that are modified on push
├── scripts/
│   ├── runDatatree.js
│   └── runAndInitSiteGen.js    // can't run if src exists and isn't empty
├── tree-debugging-ui/          // basic index.html with fat JS loading remote script to check folder
├── src/                        // all generated files from base template + siteGen outputs
└── readme.md                   // info about project usage, mix of template + generated description
```

### Online console for project managment, and running pipelines.

We could use midrun layout style for the UI.

A replicate or github-like UI where a user can see their Genas.

We could have a store with model adapters from replicate, huggingface, etc.

User could setup keys in their profile.

The Core lib could run as open source. npm import.
@genarun/core

We could also include all the adapters selectively.

import {replicateAdapter} from @genarun/adapters

# API client

Freemium.

We automatically provide an API key to users.

Free API use, We give a lot of FREE minutes per month for generations.

We provide an API client to let users CONSUME the API

const gena = new GenarunApiClient('apiKey')

const genaLocal = new GenarunLocalClient({
openaiKey= 124,
replicateKey:1234
///other keys, required based on your adapters
})

//if you use the local client, the generations process will happen locally and resolve at the end. No support for webhook. You can however monitor progress using the onUpdate: (event) handler in options.

API needs to wrap the output in a data prop or output. So the dbug detailled response dont force syntax change.

ex:

params = {
year: 2025,
}

options = {
tree: 'felix/weird',
doneHook: mysite.com/hook/jobdone/132456,
onUpdate: (a) => console.log(a) //progress monitoring if using the local client
detailled_response: false //default false// output not just the pretty object, but all the logs, read input, and raw generations, useful for debugging

}

const data = await gena.run('felix/weird') // cleanest

runid = gena.start( params, options) // returns a run id.

#### api keys

we want the api to be able to work fully on client, no secrets sensitive.
so we'll let user:
Whitelist specific domains/origins via CORS
Require signed requests with timestamps
Add IP address restrictions where feasible

For the web client, we'll just allow it to run, since it's not sharing the openAi or underlying keys, it's triggering stuff, but of less use. We can also add domain restriction or throttle, but to really be safe, it's best to also protect the key.
The key is read-only, so not mission critical to share it, and limited scope. It can increase your bill at processing providers.
