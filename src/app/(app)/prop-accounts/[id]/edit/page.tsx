import { notFound } from "next/navigation";
import { getPropAccount } from "@/lib/queries/prop-accounts";
import { PropAccountForm } from "@/components/prop-accounts/PropAccountForm";

export default async function EditPropAccountPage(props: PageProps<"/prop-accounts/[id]/edit">) {
  const { id } = await props.params;
  const propAccount = await getPropAccount(id);
  if (!propAccount) notFound();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text">Edit Prop Account</h1>
      <PropAccountForm
        propAccountId={propAccount.id}
        initial={{
          accountName: propAccount.account.name,
          firmName: propAccount.firmName,
          challengeType: propAccount.challengeType ?? "2-step",
          phase: propAccount.phase,
          accountSize: propAccount.accountSize,
          profitTarget: propAccount.profitTarget,
          maxDailyLoss: propAccount.maxDailyLoss,
          maxTotalDrawdown: propAccount.maxTotalDrawdown,
          startDate: propAccount.startDate ? propAccount.startDate.toISOString().slice(0, 10) : null,
        }}
      />
    </div>
  );
}
