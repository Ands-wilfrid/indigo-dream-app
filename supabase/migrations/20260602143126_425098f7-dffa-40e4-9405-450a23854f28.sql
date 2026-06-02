CREATE POLICY "Creators see their projects"
ON public.projects
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Creators update their projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (created_by = auth.uid());
