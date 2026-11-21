//Runs in the browser before every ui test file, see setupFiles in vite.config.ts
//Test files that run one after another in a browser session share the local storage,
//so settings an earlier file stored, like the theme settings, would be read by the next file when its modules load
localStorage.clear();
