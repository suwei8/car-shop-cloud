# TASK-PM-004 — 清理被 git 跟踪的大文件/敏感产物

> 创建人：PM Agent
> 创建时间：2026-06-14
> 优先级：P1
> 背景：仓库里有两个不该被跟踪的产物文件，`.gitignore` 也未覆盖：
> - `erp.baisyi.cn.har`（**2.8MB**，竞品 erp.baisyi.cn 的 HAR 抓包，**可能含 cookie / token / 请求体等敏感数据**）；
> - `car-handoff-20260528-165744.tar.gz`（56KB，历史交接打包产物）。

---

## 1. 任务目标

把上述两个文件从 git **跟踪中移除**（保留本地文件，不物理删除磁盘上的），并加入 `.gitignore` 防止再次被提交。**只提交不 push**。

> HAR 文件可能含敏感信息：取消跟踪只影响“将来”，文件仍存在于历史提交中。是否进一步“清理 git 历史”见第 3 节，需用户单独确认后才做。

---

## 2. 必做步骤（安全，可直接执行）

1. 取消跟踪（保留本地文件）：
   ```bash
   cd /home/sw/dev_root/car
   git rm --cached "erp.baisyi.cn.har" "car-handoff-20260528-165744.tar.gz"
   ```
2. 更新 `.gitignore`，追加：
   ```
   # 抓包 / 交接打包 / 临时产物
   *.har
   *.tar.gz
   *.log
   ```
   （`*.log` 顺带覆盖，避免日志入库；确认不会误伤需要入库的文件）
3. 提交：
   ```
   git commit -m "chore: 取消跟踪抓包/打包产物并补充 .gitignore"
   ```
4. 不要 push。

## 3. 可选步骤（需用户单独确认后才执行）

> ⚠️ 以下会**重写 git 历史**，属于破坏性操作，且若仓库已被他人 clone 会造成分叉。**未经用户明确二次确认，禁止执行。**

如需把 `erp.baisyi.cn.har` 从历史中彻底抹除（因其可能含敏感抓包）：
- 使用 `git filter-repo`（推荐）或 BFG，将该文件从所有历史提交移除；
- 操作前先备份仓库；
- 执行后需要 force 同步远端（如已 push 过）。

本任务**默认只做第 2 节**；第 3 节仅在用户回执确认后由后续任务处理。

## 4. 验收标准

- [ ] `git ls-files | grep -E "\.har$|\.tar\.gz$"` 无输出（不再被跟踪）；
- [ ] 两个文件在磁盘上仍存在（未物理删除）；
- [ ] `.gitignore` 已包含 `*.har` / `*.tar.gz` / `*.log`；
- [ ] 已提交且未 push；
- [ ] 未执行历史重写（除非用户另行确认）。

### 验证命令
```bash
cd /home/sw/dev_root/car
git ls-files | grep -E "\.har$|\.tar\.gz$" || echo "OK: 不再被跟踪"
ls -la erp.baisyi.cn.har car-handoff-20260528-165744.tar.gz
git status
git log --oneline -3
```

## 5. 回执区域（执行 Agent 填写）

### 5.1 执行摘要
- 执行人：Antigravity
- 时间：2026-06-14
- 结论：已顺利且安全地将大文件/敏感产物 `erp.baisyi.cn.har` 与 `car-handoff-20260528-165744.tar.gz` 从 Git 跟踪中移除（物理文件安全地保留在本地磁盘）。完成了 `.gitignore` 过滤规则的更新，且已做本地提交。

### 5.2 验收结果
| 检查项 | 结果 | 说明 |
|--------|------|------|
| 两文件取消跟踪 | ✅ 通过 | 执行 `git ls-files` 匹配无任何输出，已不再被跟踪。 |
| 本地文件保留 | ✅ 通过 | 执行 `ls -la`，两个文件在本地磁盘依然完整保留。 |
| .gitignore 更新 | ✅ 通过 | 成功追加了对 `*.har` / `*.tar.gz` / `*.log` 的忽略规则。 |
| 已提交未 push | ✅ 通过 | 已通过本地 git commit 提交该清理，并未执行 git push。 |
| 未重写历史 | ✅ 通过 | 严格遵守要求，未对 Git 历史记录进行任何重写操作。 |

### 5.3 备注（是否建议清理历史）
- **清理历史建议**：由于 `erp.baisyi.cn.har` 竞品抓包数据可能包含敏感鉴权 Cookie/Token，如果后续该代码库需要公开或对第三方协作者可见，强烈建议由 PM 或用户确认后，再安排任务执行 `git filter-repo` 将其从历史提交中彻底抹除。

## 6. 派发词

```text
你是车店云管家项目的执行 Agent。请完成 TASK-PM-004（清理被 git 跟踪的大文件/敏感产物）。

工作目录：/home/sw/dev_root/car
任务书：/home/sw/dev_root/car/docs/TASK-PM-004-cleanup-tracked-artifacts.md

只做任务书第 2 节（安全步骤）：
1. git rm --cached 取消跟踪 erp.baisyi.cn.har 与 car-handoff-20260528-165744.tar.gz（保留本地文件，不删磁盘）。
2. .gitignore 追加 *.har / *.tar.gz / *.log（确认不误伤需入库文件）。
3. git commit 提交，不要 push。
禁止执行第 3 节的历史重写（git filter-repo/BFG），除非另有明确指示。
完成后执行第 4 节验证命令，回执填入第 5 节，不得改动其他章节。完成后停止等待审核。
```
