import { defineRailway, github, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const serverVolume = volume("server-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-east4-eqdc4a", sizeMB: 5000 });
  const server = service("server", {
    source: github("ArturoGomezGz/pos-Mazatl-n-", { branch: "master", checkSuites: false, rootDirectory: "/" }),
    build: { buildCommand: "npm run build", buildEnvironment: "V3", builder: "RAILPACK", watchPatterns: ["/server/**", "/client/**"] },
    start: "npm run start --workspace=server",
    healthcheck: "/api/salud",
    healthcheckTimeout: 100,
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
    replicas: { "us-east4-eqdc4a": 1 },
    volumeMounts: {
      "/data": serverVolume,
    },
    env: {
      CORS_ORIGEN: preserve(),
      DB_RUTA: preserve(),
      NODE_ENV: preserve(),
    },
  });

  return project("extraordinary-courage", {
    resources: [server, serverVolume],
  });
});
