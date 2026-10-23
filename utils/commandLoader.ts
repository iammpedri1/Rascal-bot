const fs = require("fs");
const path = require("path");

function loadCommands(dir = path.join(__dirname, "../commands")) {
  const commands = new Map();
  const rootDir = path.resolve(dir);

  function read(folder) {
    const files = fs.readdirSync(folder);

    for (const file of files) {
      const fullPath = path.join(folder, file);

      if (fs.lstatSync(fullPath).isDirectory()) {
        read(fullPath);
      } else if (file.endsWith(".js")) {

        delete require.cache[require.resolve(fullPath)];
        const cmd = require(fullPath);

        if (cmd?.data?.name) {
          const folderCategory = path.resolve(folder) === rootDir
            ? "outros"
            : path.basename(folder);

          commands.set(cmd.data.name, {
            ...cmd,
            category: cmd.category || folderCategory,
          });
        }
      }
    }
  }

  read(dir);
  return commands;
}

module.exports = { loadCommands };
