import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseScaffoldPlanInput, runScaffoldPlanning } from "../features/workflows/index.js";
import { createState, createTempProject } from "./testUtils.js";

describe("scaffold planning workflow", () => {
  it("uses existing module conventions to shape a module scaffold plan", async () => {
    const { config, cleanup, projectRoot } = createTempProject({
      customModules: ["acme_blog"],
    });
    try {
      const moduleRoot = path.join(projectRoot, "web", "modules", "custom", "acme_blog");
      fs.writeFileSync(path.join(moduleRoot, "acme_blog.info.yml"), "name: Acme Blog\n", "utf8");
      fs.writeFileSync(path.join(moduleRoot, "acme_blog.module"), "<?php\n", "utf8");
      fs.writeFileSync(path.join(moduleRoot, "acme_blog.routing.yml"), "acme_blog.page:\n", "utf8");
      fs.writeFileSync(path.join(moduleRoot, "acme_blog.services.yml"), "services: {}\n", "utf8");
      fs.mkdirSync(path.join(moduleRoot, "src", "Controller"), { recursive: true });
      fs.mkdirSync(path.join(moduleRoot, "templates"), { recursive: true });

      const response = await runScaffoldPlanning(createState(config), {
        machine_name: "acme_news",
        target_type: "module",
      });

      assert.equal(response.status, "ok");
      assert.equal(response.data?.target_directory, "web/modules/custom/acme_news");
      assert.ok(response.data?.conventions_detected.includes("module-info-file"));
      assert.ok(response.data?.conventions_detected.includes("module-routing"));
      assert.ok(response.data?.conventions_detected.includes("module-src-tree"));
      assert.ok(response.data?.conventions_detected.includes("module-services"));
      assert.ok(response.data?.files.some((file) => file.path === "acme_news.info.yml"));
      assert.ok(response.data?.files.some((file) => file.path === "acme_news.routing.yml"));
      assert.ok(response.data?.files.some((file) => file.path === "src/Controller/AcmeNewsController.php"));
      assert.ok(response.data?.files.some((file) => file.path === "acme_news.services.yml"));
      assert.ok(response.data?.files.some((file) => file.path === "templates/acme_news.html.twig"));
    } finally {
      cleanup();
    }
  });

  it("uses existing theme conventions to shape a theme scaffold plan", async () => {
    const { config, cleanup, projectRoot } = createTempProject({
      customThemes: ["acme_theme"],
    });
    try {
      const themeRoot = path.join(projectRoot, "web", "themes", "custom", "acme_theme");
      fs.writeFileSync(path.join(themeRoot, "acme_theme.info.yml"), "name: Acme Theme\n", "utf8");
      fs.writeFileSync(path.join(themeRoot, "acme_theme.libraries.yml"), "global:\n", "utf8");
      fs.mkdirSync(path.join(themeRoot, "templates"), { recursive: true });
      fs.mkdirSync(path.join(themeRoot, "css"), { recursive: true });
      fs.mkdirSync(path.join(themeRoot, "js"), { recursive: true });

      const response = await runScaffoldPlanning(createState(config), {
        machine_name: "acme_skin",
        target_type: "theme",
      });

      assert.equal(response.status, "ok");
      assert.equal(response.data?.target_directory, "web/themes/custom/acme_skin");
      assert.ok(response.data?.conventions_detected.includes("theme-info-file"));
      assert.ok(response.data?.conventions_detected.includes("theme-libraries-file"));
      assert.ok(response.data?.conventions_detected.includes("theme-templates-tree"));
      assert.ok(response.data?.conventions_detected.includes("theme-css-tree"));
      assert.ok(response.data?.conventions_detected.includes("theme-js-tree"));
      assert.ok(response.data?.files.some((file) => file.path === "acme_skin.info.yml"));
      assert.ok(response.data?.files.some((file) => file.path === "acme_skin.libraries.yml"));
      assert.ok(response.data?.files.some((file) => file.path === "templates/page.html.twig"));
      assert.ok(response.data?.files.some((file) => file.path === "css/style.css"));
      assert.ok(response.data?.files.some((file) => file.path === "js/script.js"));
    } finally {
      cleanup();
    }
  });

  it("rejects invalid scaffold planning inputs", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = parseScaffoldPlanInput({
        machine_name: "BadName",
        target_type: "module",
      });

      assert.equal(response.ok, false);
      assert.equal(response.response.status, "error");
      assert.equal(response.response.error?.code, "E_INVALID_INPUT");
    } finally {
      cleanup();
    }
  });
});
