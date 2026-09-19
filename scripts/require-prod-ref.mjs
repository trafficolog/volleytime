const requiredRef = 'refs/heads/prod'
const actualRef = process.env.GITHUB_REF ?? '<unset>'

if (actualRef !== requiredRef) {
  console.error(`Production deployment requires ${requiredRef}; received ${actualRef}`)
  process.exit(1)
}

console.log(`Production source verified: ${requiredRef}`)
