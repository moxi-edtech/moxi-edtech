import { EmptyTasks } from "./EmptyTasks";
import { TaskItem } from "./TaskItem";

export function TaskList({
  items,
}: {
  items: Array<{
    id: string;
    created_at: string;
    aluno: { nome: string };
    turma: { nome: string };
  }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {items.length === 0 ? (
        <EmptyTasks />
      ) : (
        items.map((item) => <TaskItem key={item.id} item={item} />)
      )}
    </div>
  );
}
